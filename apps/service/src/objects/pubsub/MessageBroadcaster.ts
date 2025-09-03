import { Access } from "@repo/schemas/grant";
import { GrantSchema } from "@repo/schemas/grant";
import { MessageBody } from "@repo/schemas/messageBody";
import { QueueEnvelope } from "@repo/schemas/queueEnvelope";
import { PacketEnvelope } from "@repo/schemas/packetEnvelope";
import { monoNow } from "@/lib/monotonic";
import {
  SocketSendResult,
  MessageMetrics,
  BroadcastConfig,
  DEFAULT_BROADCAST_CONFIG,
  PublishMessageParams,
  ServiceContext,
} from "./types";
import { BaseService } from "./BaseService";
import { MessageBuffer } from "./MessageBuffer";
import { ErebusClient } from "./ErebusClient";

/**
 * Manages message broadcasting to WebSocket connections with advanced performance optimizations.
 *
 * This service handles:
 * - Broadcasting messages to all subscribed WebSocket connections
 * - Backpressure management to prevent socket buffer overflow
 * - Yielding control to prevent event loop blocking
 * - Duplicate delivery prevention
 * - Grant-based access control per topic
 * - Performance metrics and instrumentation
 * - Batch processing for optimal throughput
 */
export class MessageBroadcaster extends BaseService {
  private readonly config: BroadcastConfig;

  /** Shared TextEncoder for efficient message serialization */
  private static readonly TEXT_ENCODER = new TextEncoder();

  /**
   * Initialize the MessageBroadcaster with service dependencies and configuration.
   *
   * @param serviceContext - Service context containing DO state and environment
   * @param messageBuffer - Message buffer service for persistence operations
   * @param config - Broadcasting configuration (optional, uses defaults)
   */
  constructor(
    serviceContext: ServiceContext,
    private readonly messageBuffer: MessageBuffer,
    config: Partial<BroadcastConfig> = {},
  ) {
    super(serviceContext);
    this.config = { ...DEFAULT_BROADCAST_CONFIG, ...config };
  }

  /**
   * Publish a message to all subscribed WebSocket connections with advanced optimizations.
   *
   * This method:
   * - Pre-serializes messages once for all recipients
   * - Processes sockets in batches to prevent event loop blocking
   * - Handles backpressure by monitoring buffered amounts
   * - Prevents duplicate deliveries using client ID tracking
   * - Enforces topic-based access control
   * - Provides detailed performance metrics
   * - Manages background operations for persistence
   *
   * @param params - Publishing parameters
   * @returns Promise that resolves when publishing is complete
   */
  async publishMessage(params: PublishMessageParams): Promise<void> {
    const {
      messageBody,
      senderClientId,
      subscriberClientIds,
      projectId,
      keyId,
      channelName,
      topic,
      seq,
    } = params;

    const publishStartTime = monoNow();

    this.logDebug(
      `[PUBLISH_MESSAGE] Starting message publish - senderId: ${senderClientId}, ` +
        `topic: ${topic}, seq: ${seq}, subscribersCount: ${subscriberClientIds.length}`,
    );

    // Get all active ErebusClient connections
    const clients = this.getErebusClients();
    this.logDebug(
      `[PUBLISH_MESSAGE] Total ErebusClient connections: ${clients.length}`,
    );

    // Initialize metrics
    const metrics: MessageMetrics = {
      sentCount: 0,
      skippedCount: 0,
      duplicateCount: 0,
      errorCount: 0,
      yieldCount: 0,
      highBackpressureCount: 0,
    };

    // Track which client IDs have received the message to prevent duplicates
    const sentToClients = new Set<string>();

    // Pre-serialize the message once for all recipients (performance optimization)
    const serializedMessage = MessageBroadcaster.TEXT_ENCODER.encode(
      JSON.stringify(messageBody),
    );

    // Process clients in batches to prevent event loop blocking
    await this.processClientBatches(
      clients,
      serializedMessage,
      senderClientId,
      subscriberClientIds,
      topic,
      sentToClients,
      metrics,
    );

    // Update message timing metadata
    const tWsWriteEnd = monoNow();
    messageBody.t_ws_write_end = tWsWriteEnd;
    messageBody.t_broadcast_end = tWsWriteEnd;

    const publishDuration = tWsWriteEnd - publishStartTime;

    this.logDebug(
      `[PUBLISH_MESSAGE] Publish summary - sent: ${metrics.sentCount}, ` +
        `skipped: ${metrics.skippedCount}, duplicates: ${metrics.duplicateCount}, ` +
        `errors: ${metrics.errorCount}, yields: ${metrics.yieldCount}, ` +
        `high_backpressure: ${metrics.highBackpressureCount}, ` +
        `duration: ${publishDuration.toFixed(2)}ms`,
    );

    // Run background operations asynchronously
    await this.runBackgroundTasks(
      messageBody,
      projectId,
      keyId,
      channelName,
      topic,
      seq,
      subscriberClientIds,
    );
  }

  /**
   * Process ErebusClient connections in batches with yielding for performance.
   *
   * @param clients - Array of ErebusClient connections
   * @param serializedMessage - Pre-serialized message bytes
   * @param senderClientId - ID of the message sender
   * @param subscriberClientIds - Array of subscriber client IDs
   * @param topic - Topic being published to
   * @param sentToClients - Set tracking clients that have received the message
   * @param metrics - Metrics object to update
   */
  private async processClientBatches(
    clients: ErebusClient[],
    serializedMessage: Uint8Array,
    senderClientId: string,
    subscriberClientIds: string[],
    topic: string,
    sentToClients: Set<string>,
    metrics: MessageMetrics,
  ): Promise<void> {
    const batchSize = this.config.batchSize;

    for (let i = 0; i < clients.length; i += batchSize) {
      const batch = clients.slice(i, i + batchSize);

      // Process current batch in parallel
      const batchPromises = batch.map((client) =>
        this.processSingleClient(
          client,
          serializedMessage,
          senderClientId,
          subscriberClientIds,
          topic,
          sentToClients,
        ),
      );

      // Wait for current batch to complete
      const batchResults = await Promise.all(batchPromises);

      // Update metrics from batch results
      this.updateMetricsFromResults(metrics, batchResults);

      // Yield control to event loop between batches
      // Note from #V0ID: I have no fucking Idea what do this do, Cursor AI put it here,
      // it seems to be a performance optimization of some sort with the async engine.
      // Ama just keept real, i have no idea what do this do.
      if (i + batchSize < clients.length) {
        await this.yieldControl();
        metrics.yieldCount++;
      }
    }
  }

  /**
   * Process a single ErebusClient connection with comprehensive error handling.
   *
   * @param client - ErebusClient to process
   * @param serializedMessage - Pre-serialized message bytes
   * @param senderClientId - ID of the message sender
   * @param subscriberClientIds - Array of subscriber client IDs
   * @param topic - Topic being published to
   * @param sentToClients - Set tracking clients that have received the message
   * @returns Promise resolving to send result
   */
  private async processSingleClient(
    client: ErebusClient,
    serializedMessage: Uint8Array,
    senderClientId: string,
    subscriberClientIds: string[],
    topic: string,
    sentToClients: Set<string>,
  ): Promise<SocketSendResult> {
    try {
      const recipientClientId = client.clientId;

      // Prevent duplicate deliveries
      if (sentToClients.has(recipientClientId)) {
        return { result: "duplicate", reason: "duplicate_client" };
      }

      // Check topic access permissions using ErebusClient helpers
      if (client.hasHuhAccess(topic)) {
        // Special "Huh" scope - send informational message
        return await this.sendHuhMessage(client, sentToClients);
      } else if (client.hasReadAccess(topic)) {
        // Regular read access - send the actual message
        return await this.sendMessage(
          client,
          serializedMessage,
          senderClientId,
          subscriberClientIds,
          sentToClients,
        );
      } else {
        this.logDebug(
          `[PROCESS_CLIENT] Client ${client.clientId} lacks read scope for topic: ${topic}`,
        );
        return { result: "skipped", reason: "no_read_scope" };
      }
    } catch (error) {
      this.logDebug(`[PROCESS_CLIENT] Failed to process client: ${error}`);
      return { result: "error", reason: "exception", error };
    }
  }

  /**
   * Send a "Huh" informational message for curiosity-driven access.
   *
   * @param client - ErebusClient to send to
   * @param sentToClients - Set to update with delivered client
   * @returns Promise resolving to send result
   */
  private async sendHuhMessage(
    client: ErebusClient,
    sentToClients: Set<string>,
  ): Promise<SocketSendResult> {
    if (!client.isOpen) {
      return { result: "skipped", reason: "socket_not_open" };
    }

    const huhMessage = {
      type: "info",
      message:
        "Curious wanderer! Embark on your quest for knowledge at https://docs.erebus.sh/",
    };

    client.sendJSON(huhMessage);
    sentToClients.add(client.clientId);

    return { result: "sent", reason: "huh_scope" };
  }

  /**
   * Send the actual message with backpressure handling and access control.
   *
   * @param client - ErebusClient to send to
   * @param serializedMessage - Pre-serialized message bytes
   * @param senderClientId - ID of the message sender
   * @param subscriberClientIds - Array of subscriber client IDs
   * @param sentToClients - Set to update with delivered client
   * @returns Promise resolving to send result
   */
  private async sendMessage(
    client: ErebusClient,
    serializedMessage: Uint8Array,
    senderClientId: string,
    subscriberClientIds: string[],
    sentToClients: Set<string>,
  ): Promise<SocketSendResult> {
    const recipientClientId = client.clientId;

    // Only send to subscribers (not the sender)
    if (
      senderClientId === recipientClientId ||
      !subscriberClientIds.includes(recipientClientId)
    ) {
      return { result: "skipped", reason: "sender_or_not_subscribed" };
    }

    // Check client state
    if (!client.isOpen) {
      return { result: "skipped", reason: "socket_not_open" };
    }

    // Handle backpressure
    const backpressureResult = await this.handleBackpressure(client);
    if (backpressureResult) {
      return backpressureResult;
    }

    // Send the message (optimized with pre-serialized bytes)
    client.send(serializedMessage);
    sentToClients.add(recipientClientId);

    return { result: "sent", reason: "normal_send" };
  }

  /**
   * Handle WebSocket backpressure to prevent buffer overflow.
   *
   * @param client - ErebusClient to check
   * @returns Promise resolving to skip result if backpressure is too high, null otherwise
   */
  private async handleBackpressure(
    client: ErebusClient,
  ): Promise<SocketSendResult | null> {
    const bufferedAmount = client.bufferedAmount;

    if (bufferedAmount > this.config.backpressureThresholdHigh) {
      // Socket is severely backed up, skip this send
      return { result: "skipped", reason: "high_backpressure" };
    } else if (bufferedAmount > this.config.backpressureThresholdLow) {
      // Moderate backpressure, yield control briefly
      await this.yieldControl();
    }

    return null;
  }

  /**
   * Update metrics from batch processing results.
   *
   * @param metrics - Metrics object to update
   * @param results - Array of socket send results
   */
  private updateMetricsFromResults(
    metrics: MessageMetrics,
    results: SocketSendResult[],
  ): void {
    for (const result of results) {
      switch (result.result) {
        case "sent":
          metrics.sentCount++;
          break;
        case "skipped":
          metrics.skippedCount++;
          if (result.reason === "high_backpressure") {
            metrics.highBackpressureCount++;
          }
          break;
        case "duplicate":
          metrics.duplicateCount++;
          break;
        case "error":
          metrics.errorCount++;
          break;
      }
    }
  }

  /**
   * Run background tasks asynchronously without blocking.
   *
   * @param messageBody - Message to persist
   * @param projectId - Project identifier
   * @param channelName - Channel name
   * @param topic - Topic name
   * @param seq - Message sequence
   * @param subscriberClientIds - Array of subscriber client IDs
   */
  private async runBackgroundTasks(
    messageBody: MessageBody,
    projectId: string,
    keyId: string,
    channelName: string,
    topic: string,
    seq: string,
    subscriberClientIds: string[],
  ): Promise<void> {
    await Promise.all([
      // Buffer the message for persistence
      this.bufferMessage(messageBody, projectId, channelName, topic, seq),
      // Update last-seen sequences for all subscribers
      this.updateLastSeenBulk(
        subscriberClientIds,
        projectId,
        channelName,
        topic,
        seq,
      ),
      // Enqueue usage tracking for webhooks
      this.enqueueUsageEvent(
        "websocket.message",
        projectId,
        keyId,
        messageBody.payload.length,
      ),
    ]).catch((error) => {
      this.logDebug(`[BACKGROUND_TASKS] Background task error: ${error}`);
    });
  }

  /**
   * Yield control to the event loop to prevent blocking.
   *
   * @returns Promise that resolves on next tick
   */
  private async yieldControl(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }

  /**
   * Background operations using injected MessageBuffer service.
   */
  private async bufferMessage(
    messageBody: MessageBody,
    projectId: string,
    channelName: string,
    topic: string,
    seq: string,
  ): Promise<void> {
    await this.messageBuffer.bufferMessage(
      messageBody,
      projectId,
      channelName,
      topic,
      seq,
    );
  }

  private async updateLastSeenBulk(
    clientIds: string[],
    projectId: string,
    channelName: string,
    topic: string,
    seq: string,
  ): Promise<void> {
    await this.messageBuffer.updateLastSeenBulk({
      clientIds,
      projectId,
      channelName,
      topic,
      seq,
    });
  }

  /**
   * Broadcast presence packets to all connected ErebusClient connections.
   * This is a fire-and-forget operation with no ACKs or complex processing.
   *
   * @param presencePacket - The presence packet to broadcast
   * @param selfClient - Optional self client to send enriched packet to
   * @param subscribers - Optional list of subscribers to restrict broadcast to
   */
  async broadcastPresence(
    presencePacket: Extract<PacketEnvelope, { packetType: "presence" }>,
    selfClient?: ErebusClient,
    subscribers?: string[],
  ): Promise<void> {
    this.logDebug(
      `[PRESENCE_BROADCAST] Broadcasting presence packet for client: ${presencePacket.clientId}, topic: ${presencePacket.topic}, status: ${presencePacket.status}`,
    );

    // Get all active ErebusClient connections
    const clients = this.getErebusClients();
    this.logDebug(
      `[PRESENCE_BROADCAST] Total ErebusClient connections: ${clients.length}`,
    );

    // Prepare two variants:
    // - generic packet for other subscribers (only clientId/topic/status)
    // - enriched packet for the sender/self including the full subscribers list
    const genericPacketSerialized = MessageBroadcaster.TEXT_ENCODER.encode(
      JSON.stringify(presencePacket),
    );

    const selfPacketSerialized = MessageBroadcaster.TEXT_ENCODER.encode(
      JSON.stringify({ ...presencePacket, subscribers: subscribers ?? [] }),
    );

    // Track broadcast metrics
    let sentCount = 0;
    let errorCount = 0;

    // Process clients in batches for better performance
    const batchSize = 50; // Smaller batch size for presence updates
    for (let i = 0; i < clients.length; i += batchSize) {
      const batch = clients.slice(i, i + batchSize);

      // Process current batch in parallel
      const batchPromises = batch.map(async (client) => {
        try {
          // Check client state
          if (!client.isOpen) {
            return false;
          }

          // Optional: restrict broadcast to the provided subscribers (room members)
          if (subscribers && subscribers.length > 0) {
            if (!subscribers.includes(client.clientId)) {
              return false;
            }
          }

          // Handle backpressure if needed
          const backpressureResult = await this.handleBackpressure(client);
          if (backpressureResult) {
            return false;
          }
          this.logDebug(
            `[PRESENCE_BROADCAST] Sending presence packet to client: ${client.clientId}`,
          );

          // Send the appropriate presence packet
          if (selfClient && selfClient.clientId === client.clientId) {
            selfClient.send(selfPacketSerialized);
          } else {
            client.send(genericPacketSerialized);
          }
          return true;
        } catch (error) {
          this.logDebug(
            `[PRESENCE_BROADCAST] Failed to send to client: ${error}`,
          );
          return false;
        }
      });

      // Wait for current batch to complete
      const batchResults = await Promise.all(batchPromises);

      // Update metrics
      batchResults.forEach((sent) => {
        if (sent) {
          sentCount++;
        } else {
          errorCount++;
        }
      });

      // Yield control between batches to prevent blocking
      if (i + batchSize < clients.length) {
        await this.yieldControl();
      }
    }

    this.logDebug(
      `[PRESENCE_BROADCAST] Presence broadcast completed - sent: ${sentCount}, errors: ${errorCount}`,
    );
  }

  /**
   * Override service name for consistent logging.
   */
  protected getServiceName(): string {
    return "[MESSAGE_BROADCASTER]";
  }
}
