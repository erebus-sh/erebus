import { Access, GrantSchema, Grant } from "@repo/schemas/grant";
import {
  PacketEnvelope,
  PacketEnvelopeSchema,
} from "@repo/schemas/packetEnvelope";
import { MessageBody } from "@repo/schemas/messageBody";
import { verify } from "@/lib/jwt";
import { monoNow } from "@/lib/monotonic";
import { WsErrors } from "@/enums/wserrors";
import { BaseService } from "./BaseService";
import { SubscriptionManager } from "./SubscriptionManager";
import { MessageBuffer } from "./MessageBuffer";
import { ServiceContext } from "./types";
import { ErebusClient } from "./ErebusClient";

/**
 * Result of a broadcast operation containing sequence information for ACKs.
 */
export interface BroadcastResult {
  /** Generated sequence number for the message */
  seq: string;
  /** Server-assigned message ID */
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
  ): Promise<BroadcastResult>;
}

/**
 * Handles WebSocket message processing for all packet types in the PubSub system.
 *
 * This service coordinates:
 * - Packet parsing and validation
 * - JWT authentication and grant processing
 * - WebSocket connection lifecycle (connect)
 * - Subscription management (subscribe/unsubscribe)
 * - Message publishing with authorization and broadcasting
 * - Integration with other service components
 *
 * The handler processes packets in this order:
 * 1. Parse and validate packet envelope
 * 2. Route to appropriate packet handler
 * 3. Validate permissions and grants
 * 4. Execute the requested operation
 * 5. Return appropriate responses or close connections on errors
 */
export class MessageHandler extends BaseService {
  /**
   * Initialize the MessageHandler with service dependencies.
   *
   * @param serviceContext - Service context containing DO state and environment
   * @param subscriptionManager - Service for managing subscriptions
   * @param messageBuffer - Service for message persistence and retrieval
   * @param broadcastCoordinator - Service for coordinating message broadcasts
   * @param shardManager - Service for managing shard coordination
   * @param messageBroadcaster - Service for broadcasting presence packets
   */
  constructor(
    serviceContext: ServiceContext,
    private readonly subscriptionManager: SubscriptionManager,
    private readonly messageBuffer: MessageBuffer,
    private readonly broadcastCoordinator: MessageBroadcastCoordinator,
  ) {
    super(serviceContext);
  }

  /**
   * Process incoming WebSocket messages with comprehensive error handling.
   *
   * This method:
   * - Parses JSON and validates packet envelope structure
   * - Routes to appropriate packet type handlers
   * - Handles all errors gracefully with proper WebSocket closure
   * - Provides detailed logging for debugging
   *
   * @param ws - WebSocket connection that sent the message
   * @param message - Raw message string from WebSocket
   * @returns Promise that resolves when message processing is complete
   */
  async handleWebSocketMessage(ws: WebSocket, message: string): Promise<void> {
    const messagePreview =
      message.substring(0, 200) + (message.length > 200 ? "..." : "");
    this.logDebug(`[WS_MESSAGE] Received message: ${messagePreview}`);

    let envelope: PacketEnvelope;

    try {
      // Parse and validate the packet envelope
      const parsed = JSON.parse(message);
      this.logDebug(
        `[WS_MESSAGE] Message parsed successfully, packetType: ${parsed.packetType}`,
      );

      const envelopeResult = PacketEnvelopeSchema.safeParse(parsed);
      if (!envelopeResult.success) {
        this.logError(
          `[WS_MESSAGE] Invalid packet envelope: ${envelopeResult.error}`,
        );
        this.closeWebSocketWithError(
          ws,
          WsErrors.BadRequest,
          "Invalid packet format",
        );
        return;
      }

      envelope = envelopeResult.data;
      this.logDebug(`[WS_MESSAGE] Envelope validated successfully`);
    } catch (error) {
      this.logError(`[WS_MESSAGE] Failed to parse message as JSON: ${error}`);
      this.closeWebSocketWithError(ws, WsErrors.BadRequest, "Invalid JSON");
      return;
    }

    // Handle connect packets differently (no ErebusClient wrapper yet)
    if (envelope.packetType === "connect") {
      await this.handleConnectPacket(ws, envelope);
      return;
    }

    // For all other packets, create ErebusClient wrapper
    const client = ErebusClient.fromWebSocket(ws);
    if (!client) {
      this.logError(
        `[WS_MESSAGE] No valid grant found for ${envelope.packetType} packet`,
      );
      this.closeWebSocketWithError(ws, WsErrors.BadRequest, "Invalid grant");
      return;
    }

    await this.handleClientMessage(client, envelope);
  }

  /**
   * Handle messages from authenticated clients (non-connect packets).
   *
   * @param client - Authenticated ErebusClient
   * @param envelope - Parsed packet envelope
   */
  private async handleClientMessage(
    client: ErebusClient,
    envelope: PacketEnvelope,
  ): Promise<void> {
    this.logDebug(
      `[CLIENT_MESSAGE] Processing packet type: ${envelope.packetType} for client: ${client.clientId}`,
    );

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
          // Presence packets are server-generated, not client-sent
          this.logDebug(
            `[CLIENT_MESSAGE] Received presence packet from client - ignoring`,
          );
          break;
        default:
          this.logError(
            `[CLIENT_MESSAGE] Unknown packet type: ${(envelope as any).packetType}`,
          );
          this.closeClientWithError(
            client,
            WsErrors.BadRequest,
            "Unknown packet type",
          );
      }
    } catch (error) {
      this.logError(
        `[CLIENT_MESSAGE] Error processing ${envelope.packetType} packet: ${error}`,
      );
      this.closeClientWithError(
        client,
        WsErrors.InternalServerError,
        "Processing failed",
      );
    }
  }

  /**
   * Handle 'connect' packet for JWT authentication and grant attachment.
   *
   * This method:
   * - Verifies the JWT signature using the public key
   * - Validates the grant payload structure
   * - Attaches the parsed grant to the WebSocket for future operations
   *
   * @param ws - WebSocket connection
   * @param envelope - Parsed packet envelope
   */
  private async handleConnectPacket(
    ws: WebSocket,
    envelope: PacketEnvelope,
  ): Promise<void> {
    this.logDebug(`[WS_CONNECT] Processing connect command`);

    // Type guard to ensure this is a connect packet
    if (envelope.packetType !== "connect") {
      this.logError(
        `[WS_CONNECT] Invalid packet type for connect handler: ${envelope.packetType}`,
      );
      this.closeWebSocketWithError(
        ws,
        WsErrors.BadRequest,
        "Invalid packet type",
      );
      return;
    }

    try {
      // Verify JWT signature and extract payload
      const verified = await verify(envelope.grantJWT, this.env.PUBLIC_KEY_JWK);
      if (!verified) {
        this.logError(`[WS_CONNECT] JWT verification failed`);
        this.closeWebSocketWithError(ws, WsErrors.BadRequest, "Invalid JWT");
        return;
      }

      // Validate grant payload structure
      const payload = GrantSchema.safeParse(verified.payload);
      if (!payload.success) {
        this.logError(`[WS_CONNECT] Invalid grant schema: ${payload.error}`);
        this.closeWebSocketWithError(
          ws,
          WsErrors.BadRequest,
          "Invalid grant format",
        );
        return;
      }

      // Normalize and attach grant to WebSocket
      const attachment = {
        ...payload.data,
        issuedAt: payload.data.issuedAt,
        expiresAt: payload.data.expiresAt,
      };

      // Store the structured grant object (not JSON string)
      ws.serializeAttachment(attachment);

      this.logDebug(
        `[WS_CONNECT] JWT verified and grant attached for userId: ${attachment.userId}`,
      );

      // Enqueue usage tracking for successful connection
      await this.enqueueUsageEvent(
        "websocket.connect",
        attachment.project_id,
        attachment.key_id,
      );
    } catch (error) {
      this.logError(`[WS_CONNECT] JWT verification failed: ${error}`);
      this.closeWebSocketWithError(
        ws,
        WsErrors.BadRequest,
        "Authentication failed",
      );
    }
  }

  /**
   * Handle 'subscribe' packet for topic subscription with missed message delivery.
   *
   * This method:
   * - Validates the client's grant and authorization
   * - Checks for existing subscriptions to prevent duplicates
   * - Subscribes the client to the topic
   * - Retrieves and delivers missed messages since last seen
   *
   * @param client - ErebusClient connection
   * @param envelope - Parsed packet envelope
   */
  private async handleSubscribePacket(
    client: ErebusClient,
    envelope: PacketEnvelope,
  ): Promise<void> {
    this.logDebug(`[WS_SUBSCRIBE] Processing subscribe command`);

    // Type guard to ensure this is a subscribe packet
    if (envelope.packetType !== "subscribe") {
      this.logError(
        `[WS_SUBSCRIBE] Invalid packet type for subscribe handler: ${envelope.packetType}`,
      );
      this.closeClientWithError(
        client,
        WsErrors.BadRequest,
        "Invalid packet type",
      );
      return;
    }

    const topic = envelope.topic;
    this.logDebug(
      `[WS_SUBSCRIBE] Subscribe request - clientId: ${client.clientId}, ` +
        `topic: ${topic}, channel: ${client.channel}`,
    );

    // Check topic authorization using ErebusClient helper
    if (!client.hasTopicAccess(topic)) {
      this.logError(`[WS_SUBSCRIBE] Client not authorized for topic: ${topic}`);
      return; // Silently ignore unauthorized subscription
    }

    try {
      // Subscribe the client to the topic (handles duplicate subscriptions gracefully)
      this.logDebug(
        `[WS_SUBSCRIBE] Client authorized, proceeding with subscription`,
      );
      await this.subscriptionManager.subscribeToTopic(
        {
          topic,
          projectId: client.projectId,
          channelName: client.channel,
          clientId: client.clientId,
        },
        client,
      );
      this.logDebug(`[WS_SUBSCRIBE] Successfully subscribed to channel`);

      // Send success ACK (always send for subscribe operations)
      const subscribeAck = this.createSubscriptionAck(
        envelope.requestId,
        topic,
        "subscribed",
        "subscribe",
      );
      await this.sendAck(client, subscribeAck);
      this.logDebug(`[WS_SUBSCRIBE] Subscribe ACK sent for topic: ${topic}`);

      // Enqueue usage tracking for successful subscription
      await this.enqueueUsageEvent(
        "websocket.subscribe",
        client.projectId,
        client.keyId,
      );

      // TODO: deliverMissedMessages can be optional and better to recv via api
      // Retrieve and deliver missed messages
      await this.deliverMissedMessages(client, topic);
      this.logDebug(`[WS_SUBSCRIBE] Subscribe process completed`);
    } catch (error) {
      this.logError(`[WS_SUBSCRIBE] Subscription failed: ${error}`);
      this.closeClientWithError(
        client,
        WsErrors.InternalServerError,
        "Subscription failed",
      );
    }
  }

  /**
   * Handle 'unsubscribe' packet for topic unsubscription.
   *
   * @param client - ErebusClient connection
   * @param envelope - Parsed packet envelope
   */
  private async handleUnsubscribePacket(
    client: ErebusClient,
    envelope: PacketEnvelope,
  ): Promise<void> {
    this.logDebug(`[WS_UNSUBSCRIBE] Processing unsubscribe command`);

    // Type guard to ensure this is an unsubscribe packet
    if (envelope.packetType !== "unsubscribe") {
      this.logError(
        `[WS_UNSUBSCRIBE] Invalid packet type for unsubscribe handler: ${envelope.packetType}`,
      );
      this.closeClientWithError(
        client,
        WsErrors.BadRequest,
        "Invalid packet type",
      );
      return;
    }

    const topic = envelope.topic;
    this.logDebug(
      `[WS_UNSUBSCRIBE] Unsubscribe request - clientId: ${client.clientId}, ` +
        `topic: ${topic}, channel: ${client.channel}`,
    );

    try {
      await this.subscriptionManager.unsubscribeFromTopic({
        topic,
        projectId: client.projectId,
        channelName: client.channel,
        clientId: client.clientId,
      });
      this.logDebug(`[WS_UNSUBSCRIBE] Successfully unsubscribed from channel`);

      // Send success ACK (always send for unsubscribe operations)
      const unsubscribeAck = this.createSubscriptionAck(
        envelope.requestId,
        topic,
        "unsubscribed",
        "unsubscribe",
      );
      await this.sendAck(client, unsubscribeAck);
      this.logDebug(
        `[WS_UNSUBSCRIBE] Unsubscribe ACK sent for topic: ${topic}`,
      );
    } catch (error) {
      this.logError(`[WS_UNSUBSCRIBE] Unsubscription failed: ${error}`);
      // Don't close connection for unsubscribe failures
    }
  }

  /**
   * Handle 'publish' packet for message publishing with authorization and broadcasting.
   *
   * This method:
   * - Validates write permissions for the topic
   * - Checks subscription status
   * - Initiates message broadcasting to all shards
   * - Sends ACK responses when requested
   * - Provides performance instrumentation
   *
   * @param client - ErebusClient connection
   * @param envelope - Parsed packet envelope
   */
  private async handlePublishPacket(
    client: ErebusClient,
    envelope: PacketEnvelope,
  ): Promise<void> {
    // Capture ingress time immediately for performance tracking
    const tIngress = monoNow();

    // Type guard to ensure this is a publish packet
    if (envelope.packetType !== "publish") {
      this.logError(
        `[WS_PUBLISH] Invalid packet type for publish handler: ${envelope.packetType}`,
      );
      this.closeClientWithError(
        client,
        WsErrors.BadRequest,
        "Invalid packet type",
      );
      return;
    }

    this.logDebug(
      `[WS_PUBLISH] Ingress topic=${envelope.payload.topic ?? "n/a"} ` +
        `client=${client.clientId} t_ingress=${tIngress.toFixed(3)}ms`,
    );

    const topic = envelope.payload.topic;
    const payload = envelope.payload;
    const needsAck = envelope.ack === true;
    const clientMsgId = envelope.clientMsgId;

    this.logDebug(
      `[WS_PUBLISH] Publish request - clientId: ${client.clientId}, topic: ${topic}, channel: ${client.channel}, needsAck: ${needsAck}`,
    );

    // Check write access permissions using ErebusClient helper
    if (!client.hasWriteAccess(topic)) {
      this.logError(
        `[WS_PUBLISH] Client lacks write access for topic "${topic}"`,
      );

      // Send error ACK if requested
      if (needsAck) {
        const errorAck = this.createPublishErrorAck(
          topic,
          clientMsgId,
          "FORBIDDEN",
          "Insufficient permissions for topic",
        );
        await this.sendAck(client, errorAck);
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
      this.logError(`[WS_PUBLISH] Client not subscribed to topic [${topic}]`);

      // Send error ACK if requested
      if (needsAck) {
        const errorAck = this.createPublishErrorAck(
          topic,
          clientMsgId,
          "FORBIDDEN",
          "Must be subscribed to topic before publishing",
        );
        await this.sendAck(client, errorAck);
      }
      return;
    }

    // Mark as enqueued after authentication and routing
    const tEnqueued = monoNow();
    this.logDebug(`[WS_PUBLISH] All checks passed, broadcasting message`);

    try {
      // Delegate to broadcast coordinator for cross-shard message handling
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
        );

      // Send success ACK if requested
      if (needsAck) {
        const successAck = this.createPublishSuccessAck(
          topic,
          broadcastResult.serverMsgId,
          clientMsgId,
          broadcastResult.seq,
          tIngress,
        );
        await this.sendAck(client, successAck);
        this.logDebug(
          `[WS_PUBLISH] Success ACK sent for clientMsgId: ${clientMsgId}, seq: ${broadcastResult.seq}`,
        );
      }

      // Performance logging
      if (this.env.DEBUG) {
        const tFinish = monoNow();
        const elapsed = (tFinish - tIngress).toFixed(2);
        console.log(
          `[MESSAGE_HANDLER] [WS_PUBLISH] Done topic=${topic} client=${client.clientId} ` +
            `elapsed=${elapsed}ms (ingress=${tIngress.toFixed(3)}ms → finish=${tFinish.toFixed(3)}ms)`,
        );
      }
    } catch (error) {
      this.logError(`[WS_PUBLISH] Publish failed: ${error}`);

      // Send error ACK if requested
      if (needsAck) {
        const errorAck = this.createPublishErrorAck(
          topic,
          clientMsgId,
          "INTERNAL",
          "Message publishing failed",
        );
        await this.sendAck(client, errorAck);
      }

      // Don't close connection for publish failures, just log
    }
  }

  /**
   * Retrieve and deliver missed messages to a newly subscribed client.
   *
   * @param client - ErebusClient connection to deliver messages to
   * @param topic - Topic to retrieve messages for
   */
  private async deliverMissedMessages(
    client: ErebusClient,
    topic: string,
  ): Promise<void> {
    this.logDebug(
      `[DELIVER_MISSED] Fetching missed messages for topic: ${topic}`,
    );

    try {
      // Get last seen sequence for this client
      const lastSeqSeen = await this.messageBuffer.getLastSeen(
        client.projectId,
        client.channel,
        topic,
        client.clientId,
      );

      this.logDebug(`[DELIVER_MISSED] Last seen sequence: ${lastSeqSeen}`);

      // Retrieve messages after last seen
      const messages = await this.messageBuffer.getMessagesAfter({
        projectId: client.projectId,
        channelName: client.channel,
        topic,
        afterSeq: lastSeqSeen,
      });

      this.logDebug(
        `[DELIVER_MISSED] Retrieved ${messages.length} missed messages`,
      );

      // Send each missed message to the client
      let lastDeliveredSeq: string | null = null;
      for (const message of messages) {
        if (client.isOpen) {
          this.logDebug(
            `[DELIVER_MISSED] Sending missed message with seq: ${message.seq}`,
          );
          client.sendJSON(message);
          lastDeliveredSeq = message.seq;
        } else {
          this.logDebug(
            `[DELIVER_MISSED] WebSocket closed, stopping message delivery`,
          );
          break;
        }
      }

      // If we delivered at least one message, advance last-seen to the last delivered seq
      if (lastDeliveredSeq) {
        await this.messageBuffer.updateLastSeenSingle(
          client.projectId,
          client.channel,
          topic,
          client.clientId,
          lastDeliveredSeq,
        );
        this.logDebug(
          `[DELIVER_MISSED] Updated last-seen to seq=${lastDeliveredSeq} for clientId=${client.clientId}`,
        );
      }

      this.logDebug(`[DELIVER_MISSED] Missed message delivery completed`);
    } catch (error) {
      this.logError(
        `[DELIVER_MISSED] Error delivering missed messages: ${error}`,
      );
      // Don't close connection for missed message errors
    }
  }

  /**
   * Close WebSocket with error code and reason.
   *
   * @param ws - WebSocket to close
   * @param code - Error code
   * @param reason - Error reason
   */
  private closeWebSocketWithError(
    ws: WebSocket,
    code: number,
    reason: string,
  ): void {
    try {
      if (ws.readyState === WebSocket.READY_STATE_OPEN) {
        ws.close(code, reason);
        this.logDebug(
          `[CLOSE_WS] WebSocket closed with code ${code}: ${reason}`,
        );
      }
    } catch (error) {
      this.logError(`[CLOSE_WS] Error closing WebSocket: ${error}`);
    }
  }

  /**
   * Close ErebusClient with error code and reason.
   *
   * @param client - ErebusClient to close
   * @param code - Error code
   * @param reason - Error reason
   */
  private closeClientWithError(
    client: ErebusClient,
    code: number,
    reason: string,
  ): void {
    try {
      client.close(code, reason);
      this.logDebug(
        `[CLOSE_CLIENT] ErebusClient closed with code ${code}: ${reason}`,
      );
    } catch (error) {
      this.logError(`[CLOSE_CLIENT] Error closing ErebusClient: ${error}`);
    }
  }

  /**
   * Override service name for consistent logging.
   */
  protected getServiceName(): string {
    return "[MESSAGE_HANDLER]";
  }
}
