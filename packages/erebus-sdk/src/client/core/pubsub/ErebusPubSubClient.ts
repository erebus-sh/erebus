import type { MessageBody } from "@repo/schemas/messageBody";
import type { PacketEnvelope } from "@repo/schemas/packetEnvelope";
import type { AckCallback } from "../types";
import type { PresenceHandler } from "./Presence";
import { PubSubConnection } from "./PubSubConnection";
import { StateManager } from "./StateManager";
import { logger } from "@/internal/logger/consola";
import consola from "consola";

export type ErebusOptions = {
  wsUrl: string;
  tokenProvider: (channel: string) => Promise<string>;
  heartbeatMs?: number;
  log?: (l: "info" | "warn" | "error", msg: string, meta?: unknown) => void;
  debug?: boolean;
};

export type Handler = (
  payload: MessageBody,
  meta: { topic: string; seq: string; ts: number },
) => void;

/**
 * Refactored ErebusPubSub client using modular architecture
 */
export class ErebusPubSubClientNew {
  #conn: PubSubConnection;
  #stateManager: StateManager;
  #debug: boolean;

  constructor(opts: ErebusOptions) {
    this.#debug = opts.debug ?? false;
    const instanceId = Math.random().toString(36).substring(2, 8);

    consola.info(`[Erebus:${instanceId}] Constructor called`, {
      wsUrl: opts.wsUrl,
      hasTokenProvider: !!opts.tokenProvider,
      hasCustomLog: !!opts.log,
    });

    logger.info("Erebus constructor called", { opts });

    this.#conn = new PubSubConnection({
      url: opts.wsUrl,
      tokenProvider: opts.tokenProvider,
      channel: "", // Empty channel initially, will be set via joinChannel
      heartbeatMs: opts.heartbeatMs,
      log: opts.log,
      onMessage: (m: PacketEnvelope) => this.#handleMessage(m),
    });

    // Initialize state manager with connection ID and set channel immediately
    this.#stateManager = new StateManager(this.#conn.connectionId);
    // Channel will be set via joinChannel

    consola.info(`[Erebus:${instanceId}] Instance created successfully`, {
      wsUrl: opts.wsUrl,
    });
    logger.info("Erebus instance created", {
      wsUrl: opts.wsUrl,
    });
  }

  connect(timeout?: number) {
    const instanceId = this.#conn.connectionId;
    consola.info(`[Erebus:${instanceId}] Connect called`, { timeout });
    logger.info("Erebus.connect() called");

    if (!this.#stateManager.channel) {
      const error =
        "Channel must be set before connecting. Call joinChannel(channel) first.";
      consola.error(`[Erebus:${instanceId}] ${error}`);
      logger.error("Connect failed - no channel set");
      throw new Error(error);
    }

    // Channel is guaranteed to be set in constructor, no need to check
    this.#stateManager.clearProcessedMessages();
    return this.#conn.open(timeout);
  }

  // joinChannel method removed - channel is set in constructor

  /**
   * Join a channel for this client instance
   * @param channel The channel to join
   */
  joinChannel(channel: string): void {
    const instanceId = this.#conn.connectionId;
    consola.info(`[Erebus:${instanceId}] Joining channel`, { channel });
    logger.info("Erebus.joinChannel() called", { channel });

    if (
      !channel ||
      typeof channel !== "string" ||
      channel.trim().length === 0
    ) {
      const error = "Invalid channel: must be a non-empty string";
      consola.error(`[Erebus:${instanceId}] ${error}`, { channel });
      logger.error("Invalid channel", { channel });
      throw new Error(error);
    }

    // Update both state manager and connection
    this.#stateManager.setChannel(channel);
    this.#conn.setChannel(channel);

    consola.info(`[Erebus:${instanceId}] Channel joined successfully`, {
      channel,
    });
    logger.info("Channel joined successfully", { channel });
  }

  subscribe(topic: string, handler: Handler) {
    const instanceId = this.#conn.connectionId;
    consola.info(`[Erebus:${instanceId}] Subscribe called`, { topic });
    logger.info("Erebus.subscribe() called", { topic });

    if (!this.#stateManager.channel) {
      const error =
        "Channel must be set before subscribing. Call joinChannel(channel) first.";
      consola.error(`[Erebus:${instanceId}] ${error}`, { topic });
      logger.error("Subscribe failed - no channel set", { topic });
      throw new Error(error);
    }

    // Channel is guaranteed to be set in constructor, no need to check
    if (!topic || typeof topic !== "string" || topic.trim().length === 0) {
      const error = "Invalid topic: must be a non-empty string";
      consola.error(`[Erebus:${instanceId}] ${error}`, { topic });
      logger.error("Invalid topic", { topic });
      throw new Error(error);
    }

    if (typeof handler !== "function") {
      const error = "Invalid handler: must be a function";
      consola.error(`[Erebus:${instanceId}] ${error}`);
      logger.error("Invalid handler", { handlerType: typeof handler });
      throw new Error(error);
    }

    this.#stateManager.addHandler(topic, handler);
    this.#stateManager.addPendingSubscription(topic);
    this.#conn.subscribe(topic);
  }

  unsubscribe(topic: string) {
    const instanceId = this.#conn.connectionId;
    consola.info(`[Erebus:${instanceId}] Unsubscribe called`, { topic });
    logger.info("Unsubscribe function called", { topic });

    if (!topic || typeof topic !== "string" || topic.trim().length === 0) {
      const error = "Invalid topic: must be a non-empty string";
      consola.error(`[Erebus:${instanceId}] ${error}`, { topic });
      logger.error("Invalid topic", { topic });
      throw new Error(error);
    }

    const handlers = this.#stateManager.getHandlers(topic);
    if (!handlers || handlers.size === 0) {
      consola.warn(
        `[Erebus:${instanceId}] No handler set found during unsubscribe`,
        { topic },
      );
      logger.warn("No handler set found during unsubscribe", { topic });
      return;
    }

    this.#stateManager.clearHandlers(topic);
    this.#stateManager.removePendingSubscription(topic);
    this.#conn.unsubscribe(topic);
  }

  publish({
    topic,
    messageBody,
  }: {
    topic: string;
    messageBody: string;
  }): Promise<string> {
    return this.#publishInternal(topic, messageBody, false);
  }

  publishWithAck({
    topic,
    messageBody,
    onAck,
    timeoutMs = 30000,
  }: {
    topic: string;
    messageBody: string;
    onAck: AckCallback;
    timeoutMs?: number;
  }): Promise<string> {
    return this.#publishInternal(topic, messageBody, true, onAck, timeoutMs);
  }

  close() {
    const instanceId = this.#conn.connectionId;
    consola.info(`[Erebus:${instanceId}] Close called`);
    logger.info("Erebus.close() called");
    this.#conn.close();
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
        if (this.#stateManager.pendingSubscriptionsCount === 0) {
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
        this.#stateManager.clearPendingSubscriptions();
        checkReadiness();
      }, 100);
    });
  }

  /**
   * Development-only summary (counts & topics) to avoid poking at Maps in every test.
   */
  get __debugSummary(): {
    handlerCount: number;
    topics: string[];
    counts: Record<string, number>;
  } {
    const instanceId = this.#conn.connectionId;
    consola.info(`[Erebus:${instanceId}] __debugSummary getter called`);
    logger.info("Erebus.__debugSummary getter called");

    const counts: Record<string, number> = {};
    let handlerCount = 0;
    for (const topic of this.#stateManager.getTopicsWithHandlers()) {
      const n = this.#stateManager.getHandlerCountForTopic(topic);
      handlerCount += n;
      counts[topic] = n;
      consola.info(`[Erebus:${instanceId}] Counting handlers for topic`, {
        topic,
        count: n,
      });
      logger.info("Counting handlers for topic", {
        topic,
        count: n,
      });
    }
    consola.info(`[Erebus:${instanceId}] __debugSummary returning`, {
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
   * Development-only access to the underlying Connection instance.
   * Useful for asserting lifecycle calls in tests. Treat as read-only.
   */
  get __debugConn(): PubSubConnection {
    const instanceId = this.#conn.connectionId;
    consola.info(`[Erebus:${instanceId}] __debugConn getter called`);
    logger.info("Erebus.__debugConn getter called");
    return this.#conn;
  }

  /**
   * Development-only object for debugging
   */
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
    const instanceId = this.#conn.connectionId;
    consola.info(`[Erebus:${instanceId}] __debugObject getter called`);
    logger.info("Erebus.__debugObject getter called");

    const counts: Record<string, number> = {};
    let handlerCount = 0;
    for (const topic of this.#stateManager.getTopicsWithHandlers()) {
      const n = this.#stateManager.getHandlerCountForTopic(topic);
      handlerCount += n;
      counts[topic] = n;
      consola.info(
        `[Erebus:${instanceId}] Counting handlers for topic (debugObject)`,
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

    // Extract connection details from the connection object
    const connectionObject = {
      url: this.#conn.url,
      state: this.#conn.state,
      subs: this.#conn.subscriptions,
      bufferedAmount: this.#conn.bufferedAmount,
    };

    const debugObj = {
      conn: this.#conn,
      handlers: this.#stateManager.__debugState.handlers,
      connectionObject,
      handlerCount,
      topics: Object.keys(counts),
      counts,
      processedMessagesCount: this.#stateManager.processedMessagesCount,
    };
    consola.info(`[Erebus:${instanceId}] __debugObject returning`, debugObj);
    logger.info("Erebus.__debugObject returning", debugObj);
    return debugObj;
  }

  // Getters
  get connectionState(): string {
    return this.#conn.state;
  }

  get isConnected(): boolean {
    return this.#conn.isConnected;
  }

  get channel(): string | null {
    return this.#stateManager.channel;
  }

  get subscriptionCount(): number {
    return this.#stateManager.subscriptionCount;
  }

  get activeTopics(): string[] {
    return this.#stateManager.activeTopics;
  }

  get pendingSubscriptionsCount(): number {
    return this.#stateManager.pendingSubscriptionsCount;
  }

  get processedMessagesCount(): number {
    return this.#stateManager.processedMessagesCount;
  }

  /**
   * Register a presence handler for a specific topic
   * @param topic - The topic to listen for presence updates on
   * @param handler - The callback function to handle presence updates
   */
  onPresence(topic: string, handler: PresenceHandler): void {
    const instanceId = this.#conn.connectionId;
    consola.info(`[Erebus:${instanceId}] onPresence called`, { topic });
    logger.info("Erebus.onPresence() called", { topic });

    if (!topic || typeof topic !== "string" || topic.trim().length === 0) {
      const error = "Invalid topic: must be a non-empty string";
      consola.error(`[Erebus:${instanceId}] ${error}`, { topic });
      logger.error("Invalid topic for presence", { topic });
      throw new Error(error);
    }

    if (typeof handler !== "function") {
      const error = "Invalid handler: must be a function";
      consola.error(`[Erebus:${instanceId}] ${error}`);
      logger.error("Invalid presence handler", { handlerType: typeof handler });
      throw new Error(error);
    }

    this.#conn.onPresence(topic, handler);
    consola.info(
      `[Erebus:${instanceId}] Presence handler registered for topic`,
      {
        topic,
      },
    );
    logger.info("Presence handler registered", { topic });
  }

  /**
   * Remove a presence handler for a specific topic
   * @param topic - The topic to remove the handler from
   * @param handler - The specific handler function to remove
   */
  offPresence(topic: string, handler: PresenceHandler): void {
    const instanceId = this.#conn.connectionId;
    consola.info(`[Erebus:${instanceId}] offPresence called`, { topic });
    logger.info("Erebus.offPresence() called", { topic });

    this.#conn.offPresence(topic, handler);
    consola.info(`[Erebus:${instanceId}] Presence handler removed for topic`, {
      topic,
    });
    logger.info("Presence handler removed", { topic });
  }

  /**
   * Remove all presence handlers for a specific topic
   * @param topic - The topic to clear all handlers for
   */
  clearPresenceHandlers(topic: string): void {
    const instanceId = this.#conn.connectionId;
    consola.info(`[Erebus:${instanceId}] clearPresenceHandlers called`, {
      topic,
    });
    logger.info("Erebus.clearPresenceHandlers() called", { topic });

    this.#conn.clearPresenceHandlers(topic);
    consola.info(
      `[Erebus:${instanceId}] All presence handlers cleared for topic`,
      {
        topic,
      },
    );
    logger.info("All presence handlers cleared", { topic });
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
      connectionDetails: {
        state: this.#conn.state,
        isConnected: this.#conn.isConnected,
        isReadable: this.#conn.isReadable,
        isWritable: this.#conn.isWritable,
        channel: this.#conn.channel,
        subscriptionCount: this.#conn.subscriptionCount,
        readyState: this.#conn.readyState,
        bufferedAmount: this.#conn.bufferedAmount,
        connectionId: this.#conn.connectionId,
        url: this.#conn.url,
      },
    };
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

  #publishInternal(
    topic: string,
    messageBody: string,
    withAck: boolean = false,
    onAck?: AckCallback,
    timeoutMs?: number,
  ): Promise<string> {
    // Validation logic here (same as original)
    if (!this.#stateManager.channel) {
      throw new Error(
        "Channel must be set before publishing. Call joinChannel(channel) first.",
      );
    }

    // Channel is guaranteed to be set in constructor, no need to check
    if (!topic || typeof topic !== "string" || topic.trim().length === 0) {
      throw new Error("Invalid topic: must be a non-empty string");
    }

    if (typeof messageBody !== "string") {
      throw new Error("Invalid messageBody: must be a string");
    }

    if (withAck && !onAck) {
      throw new Error("ACK callback is required when using publishWithAck");
    }

    // Generate message payload
    const clientMsgId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const actualMessageBody: MessageBody = {
      id: "TO_BE_SAT",
      topic,
      senderId: "TO_BE_SAT",
      seq: "TO_BE_SAT",
      sentAt: new Date(),
      payload: messageBody,
      clientMsgId,
      clientPublishTs: Date.now(),
    };

    return new Promise<string>((resolve, reject) => {
      try {
        if (withAck && onAck && timeoutMs) {
          this.#conn.publishWithAck(actualMessageBody, onAck, timeoutMs);
        } else {
          this.#conn.publish(actualMessageBody);
        }
        resolve(clientMsgId);
      } catch (error) {
        reject(error);
      }
    });
  }

  #handleMessage(m: PacketEnvelope): void {
    const instanceId = this.#conn.connectionId;
    if (m.packetType !== "publish") {
      if (this.#debug) {
        consola.info(`[Erebus:${instanceId}] Ignoring non-message packetType`, {
          packetType: m.packetType,
        });
      }
      return;
    }

    const messageId = m.payload?.id || "unknown";

    // Check for duplicate messages
    if (this.#stateManager.isMessageProcessed(messageId)) {
      if (this.#debug) {
        consola.info(`[Erebus:${instanceId}] Skipping duplicate message`, {
          messageId:
            messageId.length > 8
              ? `${messageId.substring(0, 4)}...${messageId.substring(messageId.length - 4)}`
              : messageId,
          topic: m.payload?.topic,
        });
      }
      return;
    }

    this.#stateManager.addProcessedMessage(messageId);

    const handlers = this.#stateManager.getHandlers(m.payload?.topic || "");
    if (!handlers || handlers.size === 0) {
      if (this.#debug) {
        consola.warn(`[Erebus:${instanceId}] No handlers found for topic`, {
          topic: m.payload?.topic,
        });
      }
      return;
    }

    for (const fn of handlers) {
      try {
        fn(m.payload!, {
          topic: m.payload!.topic,
          seq: m.payload!.seq,
          ts: m.payload!.sentAt.getTime(),
        });
      } catch (error) {
        if (this.#debug) {
          consola.error(
            `[Erebus:${this.#conn.connectionId}] Error in message handler`,
            {
              error,
              topic: m.payload?.topic,
              messageId,
            },
          );
        }
      }
    }
  }
}
