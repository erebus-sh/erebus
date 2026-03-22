import { PresencePacket } from "@repo/schemas/packetEnvelope";
import type { Env } from "@/env";
import type { MessageBody } from "@repo/schemas/messageBody";
import { monoNow } from "@/lib/monotonic";
import { WsErrors } from "@/enums/wserrors";
import { ErebusPubSubService } from "./ErebusPubSubService";
import {
  MessageHandler,
  type MessageBroadcastCoordinator,
  type BroadcastResult,
} from "./MessageHandler";
import { SubscriptionManager } from "./SubscriptionManager";
import { MessageBroadcaster } from "./MessageBroadcaster";
import { MessageBuffer } from "./MessageBuffer";
import { SequenceManager } from "./SequenceManager";
import { ShardManager } from "./ShardManager";
import type { PublishMessageParams } from "./types";
import { ErebusClient } from "./ErebusClient";
import {
  type Logger,
  createLogger,
  getStorageValue,
  putStorageValue,
  deleteStorageValue,
} from "./service-utils";

/**
 * ChannelV1 - Main PubSub channel Durable Object.
 *
 * Orchestrates all managers using composition (not inheritance for managers).
 * Implements MessageBroadcastCoordinator for cross-shard broadcasting.
 *
 * Key improvements over previous implementation:
 * - Managers use composition instead of 3-level class hierarchy
 * - In-memory caching in SubscriptionManager, SequenceManager, ShardManager
 * - No unnecessary transactions (single-threaded DO model)
 * - DO alarm-based TTL cleanup instead of inline pruning
 * - Pre-serialized messages, Set-based subscriber lookups
 * - isPaused cached in memory
 */
export class ChannelV1
  extends ErebusPubSubService
  implements MessageBroadcastCoordinator
{
  private readonly messageHandler: MessageHandler;
  private readonly subscriptionManager: SubscriptionManager;
  private readonly messageBroadcaster: MessageBroadcaster;
  private readonly messageBuffer: MessageBuffer;
  private readonly sequenceManager: SequenceManager;
  private readonly shardManager: ShardManager;
  private readonly log: Logger;

  /** Cached paused state — invalidated on pause()/resume() */
  private pausedCache: boolean | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);

    this.log = createLogger("[CHANNEL_V1]", env);

    // Initialize managers with composition (ServiceContext + Logger)
    this.subscriptionManager = new SubscriptionManager(
      this.serviceContext,
      this,
    );
    this.messageBuffer = new MessageBuffer(this.serviceContext);
    this.sequenceManager = new SequenceManager(this.serviceContext);
    this.shardManager = new ShardManager(this.serviceContext);

    this.messageBroadcaster = new MessageBroadcaster(
      this.serviceContext,
      this.messageBuffer,
    );

    this.messageHandler = new MessageHandler(
      this.serviceContext,
      this.subscriptionManager,
      this.messageBuffer,
      this,
    );

    this.log.debug("[CONSTRUCTOR] ChannelV1 initialized");
  }

  /**
   * Handle WebSocket connection upgrades with location hint processing.
   */
  async fetch(request: Request): Promise<Response> {
    if (await this.isPaused()) {
      this.log.warn("[FETCH] Channel is paused");
      return new Response("Channel is paused", { status: 403 });
    }

    const locationHint = request.headers.get("x-location-hint");
    if (!locationHint) {
      this.log.warn("[FETCH] Missing location hint");
      return new Response("Location hint is required", { status: 400 });
    }

    try {
      await this.shardManager.setLocationHint(locationHint);

      const { client, server } = this.createWebSocketPair();
      this.acceptWebSocket(server);

      this.log.debug("[FETCH] WebSocket accepted");

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    } catch (error) {
      this.log.error(`[FETCH] WebSocket setup error: ${error}`);
      return new Response("Internal Server Error", { status: 500 });
    }
  }

  /**
   * Handle incoming WebSocket messages.
   */
  async webSocketMessage(ws: WebSocket, message: string): Promise<void> {
    if (await this.isPaused()) {
      ws.close(WsErrors.Forbidden, "Channel is paused");
      return;
    }
    await this.messageHandler.handleWebSocketMessage(ws, message);
  }

  /**
   * Handle WebSocket close events with bulk cleanup.
   */
  async webSocketClose(
    ws: WebSocket,
    code?: number,
    reason?: string,
    _wasClean?: boolean,
  ): Promise<void> {
    this.log.debug(`[CLOSE] code=${code} reason=${reason?.substring(0, 100)}`);

    try {
      const client = ErebusClient.fromWebSocket(ws);
      if (!client) {
        this.log.warn("[CLOSE] No valid grant; skipping cleanup");
        return;
      }

      const subscriptionTopics = client.topics.map((t) => t.topic);
      const activeTopics = await this.subscriptionManager.getActiveTopics(
        client.projectId,
        client.channel,
      );
      const allTopics = [...new Set([...subscriptionTopics, ...activeTopics])];

      await this.subscriptionManager.bulkUnsubscribe(
        client.clientId,
        client.projectId,
        client.channel,
        allTopics,
      );

      this.log.debug("[CLOSE] Cleanup completed");
    } catch (error) {
      this.log.error(`[CLOSE] Cleanup error: ${error}`);
    } finally {
      try {
        if (ws.readyState === WebSocket.READY_STATE_OPEN) {
          ws.close(code, reason);
        }
      } catch {
        // Ignore close errors
      }
    }
  }

  /**
   * DO alarm handler — runs TTL cleanup for message buffer.
   */
  async alarm(): Promise<void> {
    this.log.debug("[ALARM] Running TTL cleanup");
    await this.messageBuffer.runTtlCleanup();
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
    webhookUrl: string,
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
      webhookUrl,
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
   * Send presence update to all connected clients.
   */
  public async sendPresenceUpdate(
    clientId: string,
    topic: string,
    projectId: string,
    channelName: string,
    action: "subscribe" | "unsubscribe",
    selfClient?: ErebusClient,
  ): Promise<void> {
    try {
      const subscribers = await this.subscriptionManager.getSubscribers(
        projectId,
        channelName,
        topic,
      );

      const presencePacket = PresencePacket.parse({
        packetType: "presence",
        clients: [
          {
            clientId,
            topic,
            status: action === "subscribe" ? "online" : "offline",
          },
        ],
      });

      await this.messageBroadcaster.broadcastPresence(
        presencePacket,
        selfClient,
        subscribers,
      );
    } catch (error) {
      this.log.error(`[PRESENCE_UPDATE] Error: ${error}`);
      // Don't fail subscription for presence errors
    }
  }

  /**
   * MessageBroadcastCoordinator: Coordinate broadcasting across all shards.
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
    webhookUrl: string,
  ): Promise<BroadcastResult> {
    const broadcastStartTime = monoNow();

    const [seq, shards, subscriberClientIds] = await Promise.all([
      this.sequenceManager.generateSequence(projectId, channelName, topic),
      this.shardManager.getAvailableShards(),
      this.subscriptionManager.getSubscribers(projectId, channelName, topic),
    ]);

    const serverMsgId = crypto.randomUUID();

    const wallClockIngressTime = Date.now() - (monoNow() - tIngress);
    const filledPayload: MessageBody = {
      ...payload,
      senderId: senderClientId,
      topic,
      sentAt: new Date(wallClockIngressTime),
      seq,
      id: serverMsgId,
      t_ingress: tIngress,
      t_enqueued: tEnqueued,
      t_broadcast_begin: 0,
      t_ws_write_end: 0,
      t_broadcast_end: 0,
    };

    filledPayload.t_broadcast_begin = monoNow();

    // Local publish (prioritized for lower latency)
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
      webhookUrl,
    );

    // Remote shard broadcasts
    const remotePublishPromises: Promise<void>[] = [];
    if (shards.length > 0) {
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
            webhookUrl,
          ),
        );
      }
    }

    await localPublishPromise;

    if (remotePublishPromises.length > 0) {
      await Promise.all(remotePublishPromises).catch((error) => {
        this.log.warn(`[BROADCAST] Remote shard error: ${error}`);
      });
    }

    this.log.debug(
      `[BROADCAST] Completed in ${(monoNow() - broadcastStartTime).toFixed(2)}ms`,
    );

    return { seq, serverMsgId };
  }

  /**
   * Pause the channel. Invalidates cache.
   */
  async pause(): Promise<void> {
    await putStorageValue(this.ctx, "paused", true);
    this.pausedCache = true;
  }

  /**
   * Resume the channel. Invalidates cache.
   */
  async resume(): Promise<void> {
    await deleteStorageValue(this.ctx, "paused");
    this.pausedCache = false;
  }

  /**
   * Check if the channel is paused. Cached in memory.
   */
  async isPaused(): Promise<boolean> {
    if (this.pausedCache !== null) return this.pausedCache;
    this.pausedCache = (await getStorageValue(this.ctx, "paused")) ?? false;
    return this.pausedCache;
  }

  /**
   * Public API: Retrieve historical messages with cursor-based pagination.
   */
  async getTopicHistory(
    projectId: string,
    channelName: string,
    topic: string,
    cursor: string | null,
    limit: number,
    direction: "forward" | "backward",
  ): Promise<{ items: MessageBody[]; nextCursor: string | null }> {
    const normalizedLimit = Math.min(Math.max(1, limit), 1000);

    let items: MessageBody[];

    if (direction === "forward") {
      items = await this.messageBuffer.getMessagesAfter({
        projectId,
        channelName,
        topic,
        afterSeq: cursor ?? undefined,
        limit: normalizedLimit,
      });
    } else {
      items = await this.messageBuffer.getMessagesBefore({
        projectId,
        channelName,
        topic,
        beforeSeq: cursor ?? undefined,
        limit: normalizedLimit,
      });
    }

    const nextCursor =
      items.length === normalizedLimit && items.length > 0
        ? items[items.length - 1].seq
        : null;

    return { items, nextCursor };
  }
}
