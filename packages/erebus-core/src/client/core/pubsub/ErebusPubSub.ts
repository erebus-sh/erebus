import { PubSubConnection } from "./pubsubConnection";
import { logger } from "@/internal/logger/consola";
import type { MessageBody } from "@/internal/schemas/messageBody";
import type { PacketEnvelope } from "@/internal/schemas/packetEnvelope";
import consola from "consola";

export type ErebusOptions = {
  wsUrl: string;
  tokenProvider: (channel: string) => Promise<string>;
  heartbeatMs?: number;
  log?: (l: "info" | "warn" | "error", msg: string, meta?: unknown) => void;
  debug?: boolean; // enable verbose per-message logs
};

export type Handler = (
  payload: MessageBody,
  meta: { topic: string; seq: string; ts: number },
) => void;

export class ErebusPubSubClient {
  #conn: PubSubConnection;
  #handlers = new Map<string, Set<Handler>>();
  #instanceId: string;
  #processedMessages = new Set<string>(); // Track processed message IDs to prevent duplicates
  #pendingSubscriptions = new Set<string>(); // Track subscriptions awaiting acknowledgment
  #channel: string | null = null;
  #debug: boolean;
  constructor(opts: ErebusOptions) {
    this.#instanceId = Math.random().toString(36).substring(2, 8);
    this.#debug = opts.debug ?? false;
    consola.info(`[Erebus:${this.#instanceId}] Constructor called`, {
      wsUrl: opts.wsUrl,
      heartbeatMs: opts.heartbeatMs,
      hasTokenProvider: !!opts.tokenProvider,
      hasCustomLog: !!opts.log,
    });

    logger.info("Erebus constructor called", { opts });
    this.#conn = new PubSubConnection({
      url: opts.wsUrl,
      tokenProvider: opts.tokenProvider,
      channel: this.#channel || "", // Will be set properly via joinChannel
      heartbeatMs: opts.heartbeatMs,
      log: opts.log,
      onMessage: (m: PacketEnvelope) => {
        // Only access m.payload if packetType is "publish"
        let messageId = "unknown";
        if (m.packetType === "publish" && m.payload && "id" in m.payload) {
          messageId = m.payload.id;
        }
        const maskedId =
          messageId.length > 8
            ? `${messageId.substring(0, 4)}...${messageId.substring(messageId.length - 4)}`
            : messageId;
        if (this.#debug) {
          if (m.packetType === "publish" && m.payload) {
            consola.info(
              `[Erebus:${this.#instanceId}] Received message from server`,
              {
                messageId: maskedId,
                packetType: m.packetType,
                topic: m.payload.topic,
                seq: m.payload.seq,
              },
            );
          } else {
            consola.info(
              `[Erebus:${this.#instanceId}] Received message from server`,
              {
                messageId: maskedId,
                packetType: m.packetType,
              },
            );
          }
        }

        logger.info("Received message from server", { message: m });
        if (m.packetType !== "publish") {
          if (this.#debug) {
            consola.info(
              `[Erebus:${this.#instanceId}] Ignoring non-message packetType`,
              {
                packetType: m.packetType,
              },
            );
          }
          logger.info("Ignoring non-message packetType", {
            packetType: m.packetType,
          });
          return; // ignore ack/error for now
        }

        // Check for duplicate messages
        if (this.#processedMessages.has(messageId)) {
          if (this.#debug) {
            consola.info(
              `[Erebus:${this.#instanceId}] Skipping duplicate message`,
              {
                messageId: maskedId,
                topic: m.payload.topic,
              },
            );
          }
          logger.info("Skipping duplicate message", {
            messageId,
            topic: m.payload.topic,
          });
          return;
        }

        // Add message ID to processed set
        this.#processedMessages.add(messageId);

        // Clean up old message IDs to prevent memory leaks (keep last 1000)
        if (this.#processedMessages.size > 1000) {
          const ids = Array.from(this.#processedMessages);
          this.#processedMessages.clear();
          // Keep the most recent 500 IDs
          ids.slice(-500).forEach((id) => this.#processedMessages.add(id));
        }

        const set = this.#handlers.get(m.payload.topic);
        if (!set) {
          if (this.#debug) {
            consola.warn(
              `[Erebus:${this.#instanceId}] No handlers found for topic`,
              {
                topic: m.payload.topic,
              },
            );
          }
          logger.warn("No handlers found for topic", {
            topic: m.payload.topic,
          });
          return;
        }
        for (const fn of set) {
          if (this.#debug) {
            consola.info(
              `[Erebus:${this.#instanceId}] Invoking handler for topic`,
              {
                topic: m.payload.topic,
                handlerCount: set.size,
              },
            );
          }
          logger.info("Invoking handler for topic", { topic: m.payload.topic });

          try {
            fn(m.payload, {
              topic: m.payload.topic,
              seq: m.payload.seq,
              ts: m.payload.sentAt.getTime(),
            });
          } catch (error) {
            if (this.#debug) {
              consola.error(
                `[Erebus:${this.#instanceId}] Error in message handler`,
                { error, topic: m.payload.topic, messageId: messageId },
              );
            }
            logger.error("Error in message handler", {
              error,
              topic: m.payload.topic,
              messageId,
            });
            // Continue processing other handlers even if one fails
          }
        }
      },
    });
    consola.info(`[Erebus:${this.#instanceId}] Instance created successfully`, {
      wsUrl: opts.wsUrl,
    });
    logger.info("Erebus instance created", { wsUrl: opts.wsUrl });
  }

  connect(timeout?: number) {
    consola.info(`[Erebus:${this.#instanceId}] Connect called`, { timeout });
    logger.info("Erebus.connect() called");

    // Validate that channel is set before connecting
    if (!this.#channel) {
      const error =
        "Channel must be set before connecting. Call joinChannel(channel) first.";
      consola.error(`[Erebus:${this.#instanceId}] ${error}`);
      logger.error("Connect failed - no channel set");
      throw new Error(error);
    }

    consola.info(`[Erebus:${this.#instanceId}] Connecting with channel`, {
      channel: this.#channel,
    });
    logger.info("Erebus.connect() proceeding with channel", {
      channel: this.#channel,
    });

    // Clear processed messages cache when reconnecting to ensure fresh message processing
    this.#processedMessages.clear();
    return this.#conn.open(timeout);
  }

  joinChannel(channel: string) {
    consola.info(`[Erebus:${this.#instanceId}] Joining channel`, { channel });
    logger.info("Erebus.joinChannel() called", { channel });

    // Validate channel
    if (
      !channel ||
      typeof channel !== "string" ||
      channel.trim().length === 0
    ) {
      const error = "Invalid channel: must be a non-empty string";
      consola.error(`[Erebus:${this.#instanceId}] ${error}`, { channel });
      logger.error("Invalid channel", { channel });
      throw new Error(error);
    }

    this.#channel = channel;
    // Update the connection with the new channel
    this.#conn.setChannel(channel);
  }

  subscribe(topic: string, handler: Handler) {
    consola.info(`[Erebus:${this.#instanceId}] Subscribe called`, {
      topic,
      handlerType: typeof handler,
      channel: this.#channel,
      existingHandlers: this.#handlers.has(topic)
        ? this.#handlers.get(topic)!.size
        : 0,
    });

    logger.info("Erebus.subscribe() called", {
      topic,
      handler,
      channel: this.#channel,
    });

    // Validate that channel is set before subscribing
    if (!this.#channel) {
      const error =
        "Channel must be set before subscribing. Call joinChannel(channel) first.";
      consola.error(`[Erebus:${this.#instanceId}] ${error}`, { topic });
      logger.error("Subscribe failed - no channel set", { topic });
      throw new Error(error);
    }

    // Validate inputs
    if (!topic || typeof topic !== "string" || topic.trim().length === 0) {
      const error = "Invalid topic: must be a non-empty string";
      consola.error(`[Erebus:${this.#instanceId}] ${error}`, { topic });
      logger.error("Invalid topic", { topic });
      throw new Error(error);
    }

    if (typeof handler !== "function") {
      const error = "Invalid handler: must be a function";
      consola.error(`[Erebus:${this.#instanceId}] ${error}`, {
        handlerType: typeof handler,
      });
      logger.error("Invalid handler", { handlerType: typeof handler });
      throw new Error(error);
    }

    if (!this.#handlers.has(topic)) {
      consola.info(
        `[Erebus:${this.#instanceId}] Creating new handler set for topic`,
        { topic },
      );
      logger.info("Creating new handler set for topic", { topic });
      this.#handlers.set(topic, new Set());
    }
    this.#handlers.get(topic)!.add(handler);
    consola.info(`[Erebus:${this.#instanceId}] Handler added for topic`, {
      topic,
      handlerCount: this.#handlers.get(topic)!.size,
    });
    logger.info("Handler added for topic", {
      topic,
      handlerCount: this.#handlers.get(topic)!.size,
    });

    // Track pending subscription
    this.#pendingSubscriptions.add(topic);
    this.#conn.subscribe(topic);
  }

  unsubscribe(topic: string) {
    consola.info(`[Erebus:${this.#instanceId}] Unsubscribe called`, {
      topic,
      existingHandlers: this.#handlers.has(topic)
        ? this.#handlers.get(topic)!.size
        : 0,
    });

    logger.info("Unsubscribe function called", { topic });

    // Validate inputs
    if (!topic || typeof topic !== "string" || topic.trim().length === 0) {
      const error = "Invalid topic: must be a non-empty string";
      consola.error(`[Erebus:${this.#instanceId}] ${error}`, { topic });
      logger.error("Invalid topic", { topic });
      throw new Error(error);
    }

    const set = this.#handlers.get(topic);
    if (!set) {
      consola.warn(
        `[Erebus:${this.#instanceId}] No handler set found during unsubscribe`,
        { topic },
      );
      logger.warn("No handler set found during unsubscribe", { topic });
      return;
    }

    // Clear all handlers for this topic
    set.clear();

    consola.info(
      `[Erebus:${this.#instanceId}] All handlers removed for topic`,
      {
        topic,
      },
    );
    logger.info("All handlers removed for topic", { topic });

    // Remove the topic from handlers map and unsubscribe from connection
    this.#handlers.delete(topic);
    this.#pendingSubscriptions.delete(topic);
    this.#conn.unsubscribe(topic);
  }

  publish({
    topic,
    messageBody,
  }: {
    topic: string;
    messageBody: string;
  }): Promise<void> {
    // Validate that channel is set before publishing
    if (!this.#channel) {
      const error =
        "Channel must be set before publishing. Call joinChannel(channel) first.";
      consola.error(`[Erebus:${this.#instanceId}] ${error}`, { topic });
      logger.error("Publish failed - no channel set", { topic });
      throw new Error(error);
    }

    // Validate inputs
    if (!topic || typeof topic !== "string" || topic.trim().length === 0) {
      const error = "Invalid topic: must be a non-empty string";
      consola.error(`[Erebus:${this.#instanceId}] ${error}`, { topic });
      logger.error("Invalid topic", { topic });
      throw new Error(error);
    }

    if (typeof messageBody !== "string") {
      const error = "Invalid messageBody: must be a string";
      consola.error(`[Erebus:${this.#instanceId}] ${error}`, {
        messageBodyType: typeof messageBody,
      });
      logger.error("Invalid messageBody", {
        messageBodyType: typeof messageBody,
      });
      throw new Error(error);
    }

    const maskedMessageBody =
      messageBody.length > 20
        ? `${messageBody.substring(0, 10)}...${messageBody.substring(messageBody.length - 10)}`
        : messageBody;

    consola.info(`[Erebus:${this.#instanceId}] Publish called`, {
      topic,
      channel: this.#channel,
      messageBody: maskedMessageBody,
      messageLength: messageBody.length,
    });

    // Check if we have handlers for this topic (optional validation)
    if (!this.#handlers.has(topic)) {
      consola.warn(
        `[Erebus:${this.#instanceId}] Publishing to topic with no handlers`,
        { topic },
      );
      logger.warn("Publishing to topic with no handlers", { topic });
    }

    /**
     * TODO: We might need to find a new schema for client sat
     *       because it contain unuseable fields like id, seq, sentAt
     */
    // Generate client-side correlation fields
    const clientMsgId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : undefined;
    const clientPublishTs = Date.now();

    const actualMessageBody: MessageBody = {
      id: "TO_BE_SAT",
      topic,
      senderId: "TO_BE_SAT",
      seq: "TO_BE_SAT",
      sentAt: new Date(), // Note: this is not used by the server, but we need to set it to something
      payload: messageBody,
      ...(clientMsgId ? { clientMsgId } : {}),
      clientPublishTs,
    };
    consola.info(`[Erebus:${this.#instanceId}] Publishing message`, {
      messageBody: actualMessageBody,
    });
    logger.info("Erebus.publish() called", { messageBody: actualMessageBody });
    logger.info("Erebus.publish() topic", { topic });
    // messageBody MUST contain topic (your rule)
    // optionally self-validate here if you export MessageBodySchema

    return new Promise<void>((resolve, reject) => {
      try {
        this.#conn.publish(actualMessageBody);
        // For better timing accuracy, we should resolve after the WebSocket send
        // but since WebSocket.send() is synchronous, we resolve immediately
        // In a real implementation, you might want to wait for a server ACK
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Check if all subscriptions are ready (for more accurate latency testing)
   * In a real implementation, this would wait for server acknowledgments
   */
  async waitForSubscriptionReadiness(timeoutMs: number = 1000): Promise<void> {
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const checkReadiness = () => {
        // In a real implementation, we'd wait for server ACKs
        // For now, we assume subscriptions are ready after a short delay
        if (this.#pendingSubscriptions.size === 0) {
          resolve();
          return;
        }

        if (Date.now() - startTime > timeoutMs) {
          reject(
            new Error(`Subscription readiness timeout after ${timeoutMs}ms`),
          );
          return;
        }

        setTimeout(checkReadiness, 50);
      };

      // Simulate acknowledgment after a short delay
      setTimeout(() => {
        this.#pendingSubscriptions.clear();
        checkReadiness();
      }, 100);
    });
  }

  /**
   * Internal: determine if we should expose debug getters.
   * We keep this logic here so tests can switch NODE_ENV.
   */
  private static __isProd(): boolean {
    try {
      // If process is undefined (e.g., some browsers), default to non-prod to aid local tests
      const isProd =
        typeof process !== "undefined" &&
        process.env?.NODE_ENV === "production";
      consola.info(`[Erebus] __isProd() called`, { isProd });
      logger.info("Erebus.__isProd() called", { isProd });
      return isProd;
    } catch (err) {
      consola.warn(`[Erebus] __isProd() error`, { err });
      logger.warn("Erebus.__isProd() error", { err });
      return false;
    }
  }

  /**
   * Development-only snapshot of handlers.
   * Returns **copies** so tests can inspect safely without mutating internals.
   *
   * @example
   *   const snap = client.__debugHandlers; // Map<string, Set<Handler>>
   *   expect(snap.get("topic")?.size).toBe(1)
   */
  get __debugHandlers(): ReadonlyMap<string, ReadonlySet<Handler>> {
    consola.info(`[Erebus:${this.#instanceId}] __debugHandlers getter called`);
    logger.info("Erebus.__debugHandlers getter called");
    if (ErebusPubSubClient.__isProd())
      throw new Error("Debug state not available in production builds");
    const clone = new Map<string, ReadonlySet<Handler>>();
    for (const [topic, set] of this.#handlers) {
      consola.info(
        `[Erebus:${this.#instanceId}] Cloning handler set for topic`,
        {
          topic,
          handlerCount: set.size,
        },
      );
      logger.info("Cloning handler set for topic", {
        topic,
        handlerCount: set.size,
      });
      clone.set(topic, new Set(set));
    }
    return clone;
  }

  /**
   * Development-only access to the underlying Connection instance.
   * Useful for asserting lifecycle calls in tests. Treat as read-only.
   */
  get __debugConn(): PubSubConnection {
    consola.info(`[Erebus:${this.#instanceId}] __debugConn getter called`);
    logger.info("Erebus.__debugConn getter called");
    if (ErebusPubSubClient.__isProd())
      throw new Error("Debug state not available in production builds");
    return this.#conn;
  }

  /**
   * Development-only method to clear the processed messages cache.
   * Useful for testing message deduplication.
   */
  __debugClearProcessedMessages() {
    consola.info(
      `[Erebus:${this.#instanceId}] __debugClearProcessedMessages called`,
    );
    logger.info("Erebus.__debugClearProcessedMessages called");
    if (ErebusPubSubClient.__isProd())
      throw new Error("Debug methods not available in production builds");
    this.#processedMessages.clear();
  }

  /**
   * Development-only summary (counts & topics) to avoid poking at Maps in every test.
   */
  get __debugSummary(): {
    handlerCount: number;
    topics: string[];
    counts: Record<string, number>;
  } {
    consola.info(`[Erebus:${this.#instanceId}] __debugSummary getter called`);
    logger.info("Erebus.__debugSummary getter called");
    if (ErebusPubSubClient.__isProd())
      throw new Error("Debug state not available in production builds");
    const counts: Record<string, number> = {};
    let handlerCount = 0;
    for (const [topic, set] of this.#handlers) {
      const n = set.size;
      handlerCount += n;
      counts[topic] = n;
      consola.info(`[Erebus:${this.#instanceId}] Counting handlers for topic`, {
        topic,
        count: n,
      });
      logger.info("Counting handlers for topic", { topic, count: n });
    }
    consola.info(`[Erebus:${this.#instanceId}] __debugSummary returning`, {
      handlerCount,
      topics: Object.keys(counts),
      counts,
    });
    logger.info("Erebus.__debugSummary returning", {
      handlerCount,
      topics: Object.keys(counts),
      counts,
    });
    return {
      handlerCount,
      topics: Object.keys(counts),
      counts,
    };
  }

  /**
   * Get the current connection state
   */
  get connectionState(): string {
    return this.#conn.state;
  }

  /**
   * Check if the connection is currently open and ready
   */
  get isConnected(): boolean {
    return this.#conn.isConnected;
  }

  /**
   * Check if the connection is currently connecting
   */
  get isConnecting(): boolean {
    return this.#conn.isConnecting;
  }

  /**
   * Check if the connection is currently closed
   */
  get isClosed(): boolean {
    return this.#conn.isClosed;
  }

  /**
   * Check if the connection is in idle state
   */
  get isIdle(): boolean {
    return this.#conn.isIdle;
  }

  /**
   * Check if the connection is readable (can receive messages)
   */
  get isReadable(): boolean {
    return this.#conn.isReadable;
  }

  /**
   * Check if the connection is writable (can send messages)
   */
  get isWritable(): boolean {
    return this.#conn.isWritable;
  }

  /**
   * Get the current channel name
   */
  get channel(): string | null {
    return this.#channel;
  }

  /**
   * Get the number of active subscriptions
   */
  get subscriptionCount(): number {
    return this.#handlers.size;
  }

  /**
   * Get the list of active topics
   */
  get activeTopics(): string[] {
    return Array.from(this.#handlers.keys());
  }

  /**
   * Get the number of pending subscriptions
   */
  get pendingSubscriptionsCount(): number {
    return this.#pendingSubscriptions.size;
  }

  /**
   * Get the list of pending subscriptions
   */
  get pendingSubscriptions(): string[] {
    return Array.from(this.#pendingSubscriptions);
  }

  /**
   * Get the number of processed messages
   */
  get processedMessagesCount(): number {
    return this.#processedMessages.size;
  }

  /**
   * Get connection health information
   */
  get connectionHealth(): {
    state: string;
    isConnected: boolean;
    isReadable: boolean;
    isWritable: boolean;
    channel: string | null;
    subscriptionCount: number;
    pendingSubscriptionsCount: number;
    processedMessagesCount: number;
    connectionDetails: {
      state: string;
      isConnected: boolean;
      isReadable: boolean;
      isWritable: boolean;
      channel: string;
      subscriptionCount: number;
      readyState: number | undefined;
      bufferedAmount: number;
      connectionId: string;
      url: string;
    };
  } {
    return {
      state: this.connectionState,
      isConnected: this.isConnected,
      isReadable: this.isReadable,
      isWritable: this.isWritable,
      channel: this.channel,
      subscriptionCount: this.subscriptionCount,
      pendingSubscriptionsCount: this.pendingSubscriptionsCount,
      processedMessagesCount: this.processedMessagesCount,
      connectionDetails: this.#conn.connectionHealth,
    };
  }

  /**
   * Check if a topic is currently subscribed
   */
  isSubscribed(topic: string): boolean {
    return this.#conn.isSubscribed(topic);
  }

  /**
   * Get subscription status for a topic
   */
  getSubscriptionStatus(
    topic: string,
  ): "subscribed" | "unsubscribed" | "pending" {
    return this.#conn.getSubscriptionStatus(topic);
  }

  /**
   * Get subscription tracking information
   */
  get subscriptionTracking(): {
    subscribed: string[];
    unsubscribed: string[];
    pending: string[];
  } {
    return this.#conn.subscriptionTracking;
  }

  get __debugObject(): {
    conn: PubSubConnection;
    handlers: Map<string, Set<Handler>>;
    connectionObject: {
      url: string;
      state: string;
      subs: string[];
      bufferedAmount: number;
    };
    handlerCount: number;
    topics: string[];
    counts: Record<string, number>;
    processedMessagesCount: number;
  } {
    consola.info(`[Erebus:${this.#instanceId}] __debugObject getter called`);
    logger.info("Erebus.__debugObject getter called");
    if (ErebusPubSubClient.__isProd())
      throw new Error("Debug state not available in production builds");

    const counts: Record<string, number> = {};
    let handlerCount = 0;
    for (const [topic, set] of this.#handlers) {
      const n = set.size;
      handlerCount += n;
      counts[topic] = n;
      consola.info(
        `[Erebus:${this.#instanceId}] Counting handlers for topic (debugObject)`,
        {
          topic,
          count: n,
        },
      );
      logger.info("Counting handlers for topic (debugObject)", {
        topic,
        count: n,
      });
    }

    const debugObj = {
      conn: this.#conn,
      handlers: this.#handlers,
      connectionObject: this.#conn.__debugObject,
      handlerCount,
      topics: Object.keys(counts),
      counts,
      processedMessagesCount: this.#processedMessages.size,
    };
    consola.info(
      `[Erebus:${this.#instanceId}] __debugObject returning`,
      debugObj,
    );
    logger.info("Erebus.__debugObject returning", debugObj);
    return debugObj;
  }

  close() {
    consola.info(`[Erebus:${this.#instanceId}] Close called`);
    logger.info("Erebus.close() called");
    this.#conn.close();
  }
}
