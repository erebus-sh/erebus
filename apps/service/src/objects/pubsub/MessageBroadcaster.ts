import { Access } from "@repo/schemas/grant";
import { GrantSchema } from "@repo/schemas/grant";
import { MessageBody } from "@repo/schemas/messageBody";
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
      channelName,
      topic,
      seq,
      tIngress,
    } = params;

    const publishStartTime = monoNow();

    this.logDebug(
      `[PUBLISH_MESSAGE] Starting message publish - senderId: ${senderClientId}, ` +
        `topic: ${topic}, seq: ${seq}, subscribersCount: ${subscriberClientIds.length}`,
    );

    // Get all active WebSocket connections
    const sockets = this.ctx.getWebSockets();
    this.logDebug(
      `[PUBLISH_MESSAGE] Total WebSocket connections: ${sockets.length}`,
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

    // Process sockets in batches to prevent event loop blocking
    await this.procesSocketBatches(
      sockets,
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
      channelName,
      topic,
      seq,
      subscriberClientIds,
    );
  }

  /**
   * Process WebSocket connections in batches with yielding for performance.
   *
   * @param sockets - Array of WebSocket connections
   * @param serializedMessage - Pre-serialized message bytes
   * @param senderClientId - ID of the message sender
   * @param subscriberClientIds - Array of subscriber client IDs
   * @param topic - Topic being published to
   * @param sentToClients - Set tracking clients that have received the message
   * @param metrics - Metrics object to update
   */
  private async procesSocketBatches(
    sockets: WebSocket[],
    serializedMessage: Uint8Array,
    senderClientId: string,
    subscriberClientIds: string[],
    topic: string,
    sentToClients: Set<string>,
    metrics: MessageMetrics,
  ): Promise<void> {
    const batchSize = this.config.batchSize;

    for (let i = 0; i < sockets.length; i += batchSize) {
      const batch = sockets.slice(i, i + batchSize);

      // Process current batch in parallel
      const batchPromises = batch.map((socket) =>
        this.processSingleSocket(
          socket,
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
      if (i + batchSize < sockets.length) {
        await this.yieldControl();
        metrics.yieldCount++;
      }
    }
  }

  /**
   * Process a single WebSocket connection with comprehensive error handling.
   *
   * @param socket - WebSocket to process
   * @param serializedMessage - Pre-serialized message bytes
   * @param senderClientId - ID of the message sender
   * @param subscriberClientIds - Array of subscriber client IDs
   * @param topic - Topic being published to
   * @param sentToClients - Set tracking clients that have received the message
   * @returns Promise resolving to send result
   */
  private async processSingleSocket(
    socket: WebSocket,
    serializedMessage: Uint8Array,
    senderClientId: string,
    subscriberClientIds: string[],
    topic: string,
    sentToClients: Set<string>,
  ): Promise<SocketSendResult> {
    try {
      // Validate socket has a grant attachment
      const attachment = socket.deserializeAttachment();
      if (!attachment) {
        this.logDebug(
          `[PROCESS_SOCKET] Socket does not have a grant attachment`,
        );
        return { result: "skipped", reason: "no_attachment" };
      }

      // Parse and validate grant
      const grant = GrantSchema.safeParse(attachment);
      if (!grant.success) {
        this.logDebug(
          `[PROCESS_SOCKET] Socket does not have a valid grant attachment`,
        );
        return { result: "skipped", reason: "invalid_grant" };
      }

      const recipientClientId = grant.data.userId;

      // Prevent duplicate deliveries
      if (sentToClients.has(recipientClientId)) {
        return { result: "duplicate", reason: "duplicate_client" };
      }

      // Check topic access permissions
      const topicAccess = grant.data.topics.find(
        (t) => t.topic === topic || t.topic === "*",
      );

      if (topicAccess?.scope === Access.Huh) {
        // Special "Huh" scope - send informational message
        return await this.sendHuhMessage(
          socket,
          recipientClientId,
          sentToClients,
        );
      } else if (
        topicAccess?.scope === Access.Read ||
        topicAccess?.scope === Access.ReadWrite
      ) {
        // Regular read access - send the actual message
        return await this.sendMessage(
          socket,
          serializedMessage,
          recipientClientId,
          senderClientId,
          subscriberClientIds,
          sentToClients,
        );
      } else {
        this.logDebug(
          `[PROCESS_SOCKET] Socket ${grant.data.userId} lacks read scope for topic: ${topic}`,
        );
        return { result: "skipped", reason: "no_read_scope" };
      }
    } catch (error) {
      this.logDebug(`[PROCESS_SOCKET] Failed to process socket: ${error}`);
      return { result: "error", reason: "exception", error };
    }
  }

  /**
   * Send a "Huh" informational message for curiosity-driven access.
   *
   * @param socket - WebSocket to send to
   * @param recipientClientId - Client ID of the recipient
   * @param sentToClients - Set to update with delivered client
   * @returns Promise resolving to send result
   */
  private async sendHuhMessage(
    socket: WebSocket,
    recipientClientId: string,
    sentToClients: Set<string>,
  ): Promise<SocketSendResult> {
    if (socket.readyState !== WebSocket.READY_STATE_OPEN) {
      return { result: "skipped", reason: "socket_not_open" };
    }

    const huhMessage = {
      type: "info",
      message:
        "Curious wanderer! Embark on your quest for knowledge at https://docs.erebus.sh/",
    };

    socket.send(JSON.stringify(huhMessage));
    sentToClients.add(recipientClientId);

    return { result: "sent", reason: "huh_scope" };
  }

  /**
   * Send the actual message with backpressure handling and access control.
   *
   * @param socket - WebSocket to send to
   * @param serializedMessage - Pre-serialized message bytes
   * @param recipientClientId - Client ID of the recipient
   * @param senderClientId - ID of the message sender
   * @param subscriberClientIds - Array of subscriber client IDs
   * @param sentToClients - Set to update with delivered client
   * @returns Promise resolving to send result
   */
  private async sendMessage(
    socket: WebSocket,
    serializedMessage: Uint8Array,
    recipientClientId: string,
    senderClientId: string,
    subscriberClientIds: string[],
    sentToClients: Set<string>,
  ): Promise<SocketSendResult> {
    // Only send to subscribers (not the sender)
    if (
      senderClientId === recipientClientId ||
      !subscriberClientIds.includes(recipientClientId)
    ) {
      return { result: "skipped", reason: "sender_or_not_subscribed" };
    }

    // Check socket state
    if (socket.readyState !== WebSocket.READY_STATE_OPEN) {
      return { result: "skipped", reason: "socket_not_open" };
    }

    // Handle backpressure
    const backpressureResult = await this.handleBackpressure(socket);
    if (backpressureResult) {
      return backpressureResult;
    }

    // Send the message (optimized with pre-serialized bytes)
    socket.send(serializedMessage);
    sentToClients.add(recipientClientId);

    return { result: "sent", reason: "normal_send" };
  }

  /**
   * Handle WebSocket backpressure to prevent buffer overflow.
   *
   * @param socket - WebSocket to check
   * @returns Promise resolving to skip result if backpressure is too high, null otherwise
   */
  private async handleBackpressure(
    socket: WebSocket,
  ): Promise<SocketSendResult | null> {
    const bufferedAmount = (socket as any).bufferedAmount || 0;

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
    channelName: string,
    topic: string,
    seq: string,
    subscriberClientIds: string[],
  ): Promise<void> {
    // These operations run in the background and don't block the response

    // TODO: enqueue tasks related to webhooks here
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
   * Override service name for consistent logging.
   */
  protected getServiceName(): string {
    return "[MESSAGE_BROADCASTER]";
  }
}
