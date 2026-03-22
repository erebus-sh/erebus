import { GrantSchema } from "@repo/schemas/grant";
import {
  type PacketEnvelope,
  PacketEnvelopeSchema,
} from "@repo/schemas/packetEnvelope";
import type { MessageBody } from "@repo/schemas/messageBody";
import { verify } from "@/lib/jwt";
import { monoNow } from "@/lib/monotonic";
import { WsErrors } from "@/enums/wserrors";
import { PUBSUB_CONSTANTS, type ServiceContext } from "./types";
import { type Logger, createLogger, enqueueUsageEvent } from "./service-utils";
import {
  sendAck,
  createPublishSuccessAck,
  createPublishErrorAck,
  createSubscriptionAck,
} from "./ack-utils";
import type { SubscriptionManager } from "./SubscriptionManager";
import type { MessageBuffer } from "./MessageBuffer";
import { ErebusClient } from "./ErebusClient";

/**
 * Result of a broadcast operation containing sequence information for ACKs.
 */
export interface BroadcastResult {
  seq: string;
  serverMsgId: string;
}

/**
 * Message broadcast coordinator interface for dependency injection.
 */
export interface MessageBroadcastCoordinator {
  broadcastToAllShardsAndUpdateState(
    payload: MessageBody,
    senderClientId: string,
    topic: string,
    projectId: string,
    keyId: string,
    channelName: string,
    tIngress: number,
    tEnqueued: number,
    webhookUrl: string,
  ): Promise<BroadcastResult>;
}

/**
 * Handles WebSocket message processing for all packet types.
 *
 * Uses composition instead of inheritance — no BaseService dependency.
 * ACK factories and sending use standalone functions from ack-utils.
 */
export class MessageHandler {
  private readonly ctx: DurableObjectState;
  private readonly env: ServiceContext["env"];
  private readonly log: Logger;
  private readonly subscriptionManager: SubscriptionManager;
  private readonly messageBuffer: MessageBuffer;
  private readonly broadcastCoordinator: MessageBroadcastCoordinator;

  constructor(
    serviceContext: ServiceContext,
    subscriptionManager: SubscriptionManager,
    messageBuffer: MessageBuffer,
    broadcastCoordinator: MessageBroadcastCoordinator,
  ) {
    this.ctx = serviceContext.ctx;
    this.env = serviceContext.env;
    this.log = createLogger("[MESSAGE_HANDLER]", serviceContext.env);
    this.subscriptionManager = subscriptionManager;
    this.messageBuffer = messageBuffer;
    this.broadcastCoordinator = broadcastCoordinator;
  }

  /**
   * Process incoming WebSocket messages.
   */
  async handleWebSocketMessage(ws: WebSocket, message: string): Promise<void> {
    this.log.debug(`[WS_MESSAGE] Received: ${message.substring(0, 200)}`);

    let envelope: PacketEnvelope;

    try {
      const parsed = JSON.parse(message);
      const envelopeResult = PacketEnvelopeSchema.safeParse(parsed);
      if (!envelopeResult.success) {
        this.log.error(`[WS_MESSAGE] Invalid packet: ${envelopeResult.error}`);
        this.closeWebSocket(ws, WsErrors.BadRequest, "Invalid packet format");
        return;
      }
      envelope = envelopeResult.data;
    } catch {
      this.closeWebSocket(ws, WsErrors.BadRequest, "Invalid JSON");
      return;
    }

    // Handle connect packets (no ErebusClient wrapper yet)
    if (envelope.packetType === "connect") {
      await this.handleConnectPacket(ws, envelope);
      return;
    }

    // For all other packets, require authenticated client
    const client = ErebusClient.fromWebSocket(ws);
    if (!client) {
      this.closeWebSocket(ws, WsErrors.BadRequest, "Invalid grant");
      return;
    }

    await this.handleClientMessage(client, envelope);
  }

  private async handleClientMessage(
    client: ErebusClient,
    envelope: PacketEnvelope,
  ): Promise<void> {
    try {
      switch (envelope.packetType) {
        case "subscribe":
          await this.handleSubscribePacket(client, envelope);
          break;
        case "unsubscribe":
          await this.handleUnsubscribePacket(client, envelope);
          break;
        case "publish":
          await this.handlePublishPacket(client, envelope);
          break;
        case "presence":
          // Presence packets are server-generated only
          break;
        default:
          this.closeClient(client, WsErrors.BadRequest, "Unknown packet type");
      }
    } catch (error) {
      this.log.error(`[CLIENT_MESSAGE] Error: ${error}`);
      this.closeClient(
        client,
        WsErrors.InternalServerError,
        "Processing failed",
      );
    }
  }

  /**
   * Handle 'connect' packet — JWT authentication and grant attachment.
   */
  private async handleConnectPacket(
    ws: WebSocket,
    envelope: PacketEnvelope,
  ): Promise<void> {
    if (envelope.packetType !== "connect") {
      this.closeWebSocket(ws, WsErrors.BadRequest, "Invalid packet type");
      return;
    }

    try {
      if (envelope.version !== PUBSUB_CONSTANTS.VERSION) {
        this.closeWebSocket(
          ws,
          WsErrors.VersionMismatch,
          "Invalid version current server version: " + PUBSUB_CONSTANTS.VERSION,
        );
        return;
      }

      const verified = await verify(envelope.grantJWT, this.env.PUBLIC_KEY_JWK);
      if (!verified) {
        this.closeWebSocket(ws, WsErrors.BadRequest, "Invalid JWT");
        return;
      }

      const payload = GrantSchema.safeParse(verified.payload);
      if (!payload.success) {
        this.closeWebSocket(ws, WsErrors.BadRequest, "Invalid grant format");
        return;
      }

      const attachment = {
        ...payload.data,
        issuedAt: payload.data.issuedAt,
        expiresAt: payload.data.expiresAt,
      };

      ws.serializeAttachment(attachment);

      this.log.debug(
        `[WS_CONNECT] Grant attached for userId: ${attachment.userId}`,
      );

      await enqueueUsageEvent(
        this.env,
        "websocket.connect",
        attachment.project_id,
        attachment.key_id,
      );
    } catch (error) {
      this.log.error(`[WS_CONNECT] Authentication failed: ${error}`);
      this.closeWebSocket(ws, WsErrors.BadRequest, "Authentication failed");
    }
  }

  /**
   * Handle 'subscribe' packet.
   * Fixed: sends error ACK for unauthorized topics (was silently ignoring).
   */
  private async handleSubscribePacket(
    client: ErebusClient,
    envelope: PacketEnvelope,
  ): Promise<void> {
    if (envelope.packetType !== "subscribe") {
      this.closeClient(client, WsErrors.BadRequest, "Invalid packet type");
      return;
    }

    const topic = envelope.topic;

    // Check topic authorization — close connection for unauthorized access
    // (Schema doesn't support subscription error ACKs yet)
    if (!client.hasTopicAccess(topic)) {
      this.log.error(
        `[WS_SUBSCRIBE] Client not authorized for topic: ${topic}`,
      );
      this.closeClient(
        client,
        WsErrors.Unauthorized,
        "Not authorized for this topic",
      );
      return;
    }

    try {
      await this.subscriptionManager.subscribeToTopic(
        {
          topic,
          projectId: client.projectId,
          channelName: client.channel,
          clientId: client.clientId,
        },
        client,
      );

      const subscribeAck = createSubscriptionAck(
        envelope.requestId,
        topic,
        "subscribed",
        "subscribe",
      );
      sendAck(client, subscribeAck, this.log);

      await enqueueUsageEvent(
        this.env,
        "websocket.subscribe",
        client.projectId,
        client.keyId,
      );

      if (envelope.streamOldMessages) {
        await this.deliverMissedMessages(client, topic);
      }
    } catch (error) {
      this.log.error(`[WS_SUBSCRIBE] Subscription failed: ${error}`);
      this.closeClient(
        client,
        WsErrors.InternalServerError,
        "Subscription failed",
      );
    }
  }

  /**
   * Handle 'unsubscribe' packet.
   */
  private async handleUnsubscribePacket(
    client: ErebusClient,
    envelope: PacketEnvelope,
  ): Promise<void> {
    if (envelope.packetType !== "unsubscribe") {
      this.closeClient(client, WsErrors.BadRequest, "Invalid packet type");
      return;
    }

    const topic = envelope.topic;

    try {
      await this.subscriptionManager.unsubscribeFromTopic({
        topic,
        projectId: client.projectId,
        channelName: client.channel,
        clientId: client.clientId,
      });

      const unsubscribeAck = createSubscriptionAck(
        envelope.requestId,
        topic,
        "unsubscribed",
        "unsubscribe",
      );
      sendAck(client, unsubscribeAck, this.log);
    } catch (error) {
      this.log.error(`[WS_UNSUBSCRIBE] Failed: ${error}`);
    }
  }

  /**
   * Handle 'publish' packet with authorization and broadcasting.
   */
  private async handlePublishPacket(
    client: ErebusClient,
    envelope: PacketEnvelope,
  ): Promise<void> {
    const tIngress = monoNow();

    if (envelope.packetType !== "publish") {
      this.closeClient(client, WsErrors.BadRequest, "Invalid packet type");
      return;
    }

    const topic = envelope.payload.topic;
    const payload = envelope.payload;
    const needsAck = envelope.ack === true;
    const clientMsgId = envelope.clientMsgId;

    // Check write access
    if (!client.hasWriteAccess(topic)) {
      if (needsAck) {
        sendAck(
          client,
          createPublishErrorAck(
            topic,
            clientMsgId,
            "FORBIDDEN",
            "Insufficient permissions for topic",
          ),
          this.log,
        );
      }
      return;
    }

    // Check subscription status (required for publishing)
    const isSubscribed = await this.subscriptionManager.isSubscribedToTopic({
      topic,
      projectId: client.projectId,
      channelName: client.channel,
      clientId: client.clientId,
    });

    if (!isSubscribed) {
      if (needsAck) {
        sendAck(
          client,
          createPublishErrorAck(
            topic,
            clientMsgId,
            "FORBIDDEN",
            "Must be subscribed to topic before publishing",
          ),
          this.log,
        );
      }
      return;
    }

    const tEnqueued = monoNow();

    try {
      const broadcastResult =
        await this.broadcastCoordinator.broadcastToAllShardsAndUpdateState(
          payload,
          client.clientId,
          topic,
          client.projectId,
          client.keyId,
          client.channel,
          tIngress,
          tEnqueued,
          client.webhookUrl,
        );

      if (needsAck) {
        sendAck(
          client,
          createPublishSuccessAck(
            topic,
            broadcastResult.serverMsgId,
            clientMsgId,
            broadcastResult.seq,
            tIngress,
          ),
          this.log,
        );
      }

      if (this.env.DEBUG) {
        const elapsed = (monoNow() - tIngress).toFixed(2);
        console.log(
          `[MESSAGE_HANDLER] [WS_PUBLISH] Done topic=${topic} elapsed=${elapsed}ms`,
        );
      }
    } catch (error) {
      this.log.error(`[WS_PUBLISH] Publish failed: ${error}`);
      if (needsAck) {
        sendAck(
          client,
          createPublishErrorAck(
            topic,
            clientMsgId,
            "INTERNAL",
            "Message publishing failed",
          ),
          this.log,
        );
      }
    }
  }

  /**
   * Deliver missed messages to a newly subscribed client.
   */
  private async deliverMissedMessages(
    client: ErebusClient,
    topic: string,
  ): Promise<void> {
    try {
      const lastSeqSeen = await this.messageBuffer.getLastSeen(
        client.projectId,
        client.channel,
        topic,
        client.clientId,
      );

      const messages = await this.messageBuffer.getMessagesAfter({
        projectId: client.projectId,
        channelName: client.channel,
        topic,
        afterSeq: lastSeqSeen,
      });

      let lastDeliveredSeq: string | null = null;
      for (const message of messages) {
        if (client.isOpen) {
          client.sendJSON(message);
          lastDeliveredSeq = message.seq;
        } else {
          break;
        }
      }

      if (lastDeliveredSeq) {
        await this.messageBuffer.updateLastSeenSingle(
          client.projectId,
          client.channel,
          topic,
          client.clientId,
          lastDeliveredSeq,
        );
      }
    } catch (error) {
      this.log.error(`[DELIVER_MISSED] Error: ${error}`);
    }
  }

  private closeWebSocket(ws: WebSocket, code: number, reason: string): void {
    try {
      if (ws.readyState === WebSocket.READY_STATE_OPEN) {
        ws.close(code, reason);
      }
    } catch {
      // Ignore close errors
    }
  }

  private closeClient(
    client: ErebusClient,
    code: number,
    reason: string,
  ): void {
    try {
      client.close(code, reason);
    } catch {
      // Ignore close errors
    }
  }
}
