import { GrantSchema } from "@repo/schemas/grant";
import { Env } from "@/env";
import { MessageBody } from "@repo/schemas/messageBody";
import { PacketEnvelope, PresencePacket } from "@repo/schemas/packetEnvelope";
import { monoNow } from "@/lib/monotonic";
import { ErebusPubSubService } from "./ErebusPubSubService";
import {
  MessageHandler,
  MessageBroadcastCoordinator,
  BroadcastResult,
} from "./MessageHandler";
import { SubscriptionManager } from "./SubscriptionManager";
import { MessageBroadcaster } from "./MessageBroadcaster";
import { MessageBuffer } from "./MessageBuffer";
import { SequenceManager } from "./SequenceManager";
import { ShardManager } from "./ShardManager";
import { PublishMessageParams } from "./types";

/**
 * ChannelV1 - Main PubSub channel implementation extending ErebusPubSubService.
 *
 * This class orchestrates all PubSub services to provide:
 * - WebSocket connection management with hibernation support
 * - Real-time message publishing and broadcasting
 * - Topic-based subscription management
 * - Message persistence and catch-up delivery
 * - Cross-region shard coordination
 * - Performance instrumentation and monitoring
 */
export class ChannelV1
  extends ErebusPubSubService
  implements MessageBroadcastCoordinator
{
  // Service dependencies
  private readonly messageHandler: MessageHandler;
  private readonly subscriptionManager: SubscriptionManager;
  private readonly messageBroadcaster: MessageBroadcaster;
  private readonly messageBuffer: MessageBuffer;
  private readonly sequenceManager: SequenceManager;
  private readonly shardManager: ShardManager;

  /**
   * Initialize ChannelV1 with all required services.
   *
   * @param ctx - Durable Object state context
   * @param env - Environment variables and bindings
   */
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);

    // Initialize base services first (no dependencies)
    this.subscriptionManager = new SubscriptionManager(
      this.serviceContext,
      // Pass presence update callback that delegates to MessageBroadcaster
      async (
        clientId: string,
        topic: string,
        projectId: string,
        channelName: string,
        action: "subscribe" | "unsubscribe",
      ) => {
        await this.sendPresenceUpdate(
          clientId,
          topic,
          projectId,
          channelName,
          action,
        );
      },
    );
    this.messageBuffer = new MessageBuffer(this.serviceContext);
    this.sequenceManager = new SequenceManager(this.serviceContext);
    this.shardManager = new ShardManager(this.serviceContext);

    // Initialize MessageBroadcaster with MessageBuffer dependency
    this.messageBroadcaster = new MessageBroadcaster(
      this.serviceContext,
      this.messageBuffer,
    );

    // Initialize MessageHandler with all its dependencies (including this class as coordinator)
    this.messageHandler = new MessageHandler(
      this.serviceContext,
      this.subscriptionManager,
      this.messageBuffer,
      this, // ChannelV1 implements MessageBroadcastCoordinator
    );

    this.log(
      "[CONSTRUCTOR] ChannelV1 instance created with all services initialized",
    );
  }

  /**
   * Handle WebSocket connection upgrades with location hint processing.
   */
  async fetch(request: Request): Promise<Response> {
    this.log("[FETCH] WebSocket connection request received");

    const locationHint = request.headers.get("x-location-hint");
    if (!locationHint) {
      this.log("[FETCH] Missing location hint, returning 400", "warn");
      return new Response("Location hint is required", { status: 400 });
    }

    this.log(`[FETCH] Location hint: ${locationHint}`);

    try {
      await this.shardManager.setLocationHint(locationHint);
      this.log("[FETCH] Location hint stored in shard manager");

      const { client, server } = this.createWebSocketPair();
      this.acceptWebSocket(server);
      this.log("[FETCH] WebSocket accepted, returning 101 response");

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    } catch (error) {
      this.log(
        `[FETCH] Error setting up WebSocket connection: ${error}`,
        "error",
      );
      return new Response("Internal Server Error", { status: 500 });
    }
  }

  /**
   * Handle incoming WebSocket messages by delegating to MessageHandler.
   */
  async webSocketMessage(ws: WebSocket, message: string): Promise<void> {
    await this.messageHandler.handleWebSocketMessage(ws, message);
  }

  /**
   * Handle WebSocket close events with bulk cleanup operations.
   */
  async webSocketClose(
    ws: WebSocket,
    code?: number,
    reason?: string,
    wasClean?: boolean,
  ): Promise<void> {
    const reasonPreview = reason?.substring(0, 100);
    this.log(
      `[CLOSE] WebSocket close event - code: ${code}, reason: ${reasonPreview}, wasClean: ${wasClean}`,
    );

    try {
      const grantRaw = ws.deserializeAttachment();
      const grant = GrantSchema.safeParse(grantRaw);

      if (!grant.success) {
        this.log("[CLOSE] No/invalid grant; skipping cleanup", "warn");
        return;
      }

      const { userId, project_id, channel, topics } = grant.data;
      this.log(
        `[CLOSE] Unsubscribing client from all topics - clientId: ${userId}, ` +
          `channel: ${channel}, topicCount: ${topics.length}`,
      );

      await this.subscriptionManager.bulkUnsubscribe(
        userId,
        project_id,
        channel,
        topics.map((t) => t.topic),
      );

      this.log("[CLOSE] Successfully unsubscribed from all topics");
    } catch (error) {
      this.log(`[CLOSE] Error during cleanup: ${error}`, "error");
    } finally {
      this.safeCloseWebSocket(ws);
    }
  }

  /**
   * Public API: Publish message to subscribers with cross-shard broadcasting.
   */
  async publishMessage(
    messageBody: MessageBody,
    senderClientId: string,
    subscriberClientIds: string[],
    projectId: string,
    keyId: string,
    channelName: string,
    topic: string,
    seq: string,
    tIngress: number,
  ): Promise<void> {
    const params: PublishMessageParams = {
      messageBody,
      senderClientId,
      subscriberClientIds,
      projectId,
      keyId,
      channelName,
      topic,
      seq,
      tIngress,
    };

    await this.messageBroadcaster.publishMessage(params);
  }

  /**
   * Public API: Set available shards for cross-region coordination.
   */
  async setShardsInLocalStorage(shards: string[]): Promise<void> {
    await this.shardManager.setShardsInLocalStorage(shards);
  }

  /**
   * Send presence update to all connected clients when subscription status changes.
   * Uses existing MessageBroadcaster infrastructure for efficient fire-and-forget delivery.
   *
   * @param clientId - ID of the client whose presence changed
   * @param topic - Topic that the client subscribed/unsubscribed to
   * @param projectId - Project ID for the channel
   * @param channelName - Channel name
   * @param action - Whether client subscribed (online) or unsubscribed (offline)
   */
  private async sendPresenceUpdate(
    clientId: string,
    topic: string,
    projectId: string,
    channelName: string,
    action: "subscribe" | "unsubscribe",
  ): Promise<void> {
    this.logDebug(
      `[PRESENCE_UPDATE] Sending presence update for client: ${clientId}, topic: ${topic}, action: ${action}`,
    );

    try {
      // Get current subscribers for the topic
      const subscribers = await this.subscriptionManager.getSubscribers(
        projectId,
        channelName,
        topic,
      );

      // Create presence update packet
      const presencePacket = PresencePacket.parse({
        packetType: "presence",
        clientId: clientId,
        topic: topic,
        status: action === "subscribe" ? "online" : "offline",
      });

      // Use MessageBroadcaster's optimized presence broadcasting
      await this.messageBroadcaster.broadcastPresence(presencePacket);

      this.logDebug(
        `[PRESENCE_UPDATE] Presence update broadcast completed for client: ${clientId}, subscribers: ${subscribers.length}`,
      );
    } catch (error) {
      this.log(
        `[PRESENCE_UPDATE] Error sending presence update: ${error}`,
        "error",
      );
      // Don't fail the subscription/unsubscription for presence update errors
    }
  }

  /**
   * MessageBroadcastCoordinator implementation: Coordinate message broadcasting across all shards.
   *
   * This method handles the complete message broadcasting pipeline:
   * - Generates sequence numbers and retrieves shard information
   * - Creates complete message metadata with timing instrumentation
   * - Broadcasts locally and to remote shards
   * - Manages background persistence operations
   * - Returns sequence and server message ID for ACK responses
   */
  async broadcastToAllShardsAndUpdateState(
    payload: MessageBody,
    senderClientId: string,
    topic: string,
    projectId: string,
    keyId: string,
    channelName: string,
    tIngress: number,
    tEnqueued: number,
  ): Promise<BroadcastResult> {
    const broadcastStartTime = monoNow();

    this.logDebug(
      `[BROADCAST] Starting broadcast - senderId: ${senderClientId}, topic: ${topic}`,
    );

    // Get sequence number, available shards, and subscribers in parallel
    const seqStartTime = monoNow();
    const [seq, shards, subscriberClientIds] = await Promise.all([
      this.sequenceManager.generateSequence(projectId, channelName, topic),
      this.shardManager.getAvailableShards(),
      this.subscriptionManager.getSubscribers(projectId, channelName, topic),
    ]);
    const seqDuration = monoNow() - seqStartTime;

    this.logDebug(
      `[BROADCAST] Generated sequence: ${seq}, available shards: ${shards.length}, ` +
        `subscribers: ${subscriberClientIds.length}, seq duration: ${seqDuration.toFixed(2)}ms`,
    );

    // Generate server message ID for ACK responses
    const serverMsgId = crypto.randomUUID();

    // Create complete message with timing instrumentation
    const wallClockIngressTime = Date.now() - (monoNow() - tIngress);
    const filledPayload: MessageBody = {
      ...payload,
      senderId: senderClientId,
      topic: topic,
      sentAt: new Date(wallClockIngressTime), // Wall clock time for human readability
      seq: seq,
      id: serverMsgId, // Use server message ID as the message ID
      // Timing instrumentation for performance analysis
      t_ingress: tIngress,
      t_enqueued: tEnqueued,
      t_broadcast_begin: 0, // Set just before broadcast
      t_ws_write_end: 0, // Set after local broadcast
      t_broadcast_end: 0, // Set after all broadcasts
    };

    // Mark broadcast begin time
    const tBroadcastBegin = monoNow();
    filledPayload.t_broadcast_begin = tBroadcastBegin;

    this.logDebug("[BROADCAST] Payload filled with metadata");

    // Start local publishing immediately (prioritized for lower latency)
    const localPublishPromise = this.publishMessage(
      filledPayload,
      senderClientId,
      subscriberClientIds,
      projectId,
      keyId,
      channelName,
      topic,
      seq,
      tIngress,
    );

    // Prepare remote shard broadcasts
    const remotePublishPromises: Promise<void>[] = [];
    if (shards.length > 0) {
      this.logDebug("[BROADCAST] Preparing remote shard publishes");

      for (const shard of shards) {
        const channelStub = this.env.CHANNEL.getByName(shard);
        remotePublishPromises.push(
          channelStub.publishMessage(
            filledPayload,
            senderClientId,
            subscriberClientIds,
            projectId,
            keyId,
            channelName,
            topic,
            seq,
            tIngress,
          ),
        );
      }
    }

    // Wait for local publish first (prioritized)
    await localPublishPromise;

    // Remote publishes run in background
    if (remotePublishPromises.length > 0) {
      await Promise.all(remotePublishPromises).catch((error) => {
        this.logDebug(`[BROADCAST] Remote shard publish error: ${error}`);
      });
    }

    const broadcastDuration = monoNow() - broadcastStartTime;
    this.logDebug(
      `[BROADCAST] Broadcast completed - duration: ${broadcastDuration.toFixed(2)}ms`,
    );

    // Return sequence and server message ID for ACK responses
    return {
      seq,
      serverMsgId,
    };
  }

  /**
   * Override service name for consistent logging.
   */
  protected getServiceName(): string {
    return "[CHANNEL_V1]";
  }
}
