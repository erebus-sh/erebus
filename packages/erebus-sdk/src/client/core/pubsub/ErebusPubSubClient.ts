import type { MessageBody } from "../../../../../schemas/messageBody";
import type { PacketEnvelope } from "@repo/schemas/packetEnvelope";
import { debounce } from "lodash";

import type { AckCallback, SubscriptionCallback } from "../types";
import type { PresenceHandler } from "./Presence";
import { PubSubConnection } from "./PubSubConnection";
import { StateManager } from "./StateManager";

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
export class ErebusPubSubClient {
  #conn: PubSubConnection;
  #stateManager: StateManager;
  #debug: boolean;
  #debounceOpenConnection: (timeout?: number) => void;
  #debounceSubscribe: (
    topic: string,
    handler: Handler,
    onAck?: SubscriptionCallback,
    timeoutMs?: number,
  ) => void;

  constructor(opts: ErebusOptions) {
    this.#debug = opts.debug ?? false;
    const instanceId = Math.random().toString(36).substring(2, 8);
    this.#debounceOpenConnection = debounce((timeout?: number) => {
      void this.#conn.open(timeout);
    }, 1000);

    this.#debounceSubscribe = debounce(
      (
        topic: string,
        handler: Handler,
        onAck?: SubscriptionCallback,
        timeoutMs?: number,
      ) => {
        this.subscribeWithCallback(topic, handler, onAck, timeoutMs);
      },
      1000,
    );

    console.log(`[Erebus:${instanceId}] Constructor called`, {
      wsUrl: opts.wsUrl,
      hasTokenProvider: !!opts.tokenProvider,
      hasCustomLog: !!opts.log,
    });

    console.log("Erebus constructor called", { opts });

    this.#conn = new PubSubConnection({
      url: opts.wsUrl,
      tokenProvider: opts.tokenProvider,
      channel: "", // Empty channel initially, will be set via joinChannel
      heartbeatMs: opts.heartbeatMs,
      log: opts.log,
      onMessage: (m: PacketEnvelope): void => this.#handleMessage(m),
    });

    // Initialize state manager with connection ID and set up state synchronization
    this.#stateManager = new StateManager(this.#conn.connectionId);
    this.#conn.setStateManager(this.#stateManager);
    // Channel will be set via joinChannel

    console.log(`[Erebus:${instanceId}] Instance created successfully`, {
      wsUrl: opts.wsUrl,
    });
    console.log("Erebus instance created", {
      wsUrl: opts.wsUrl,
    });
  }

  connect(timeout?: number): void {
    const instanceId = this.#conn.connectionId;
    console.log(`[Erebus:${instanceId}] Connect called`, { timeout });
    console.log("Erebus.connect() called");

    // Check if the client is already connected
    if (this.#stateManager.isConnected) {
      console.log(`[Erebus:${instanceId}] Already connected, returning`);
      // just return
      return;
    }

    if (!this.#stateManager.channel) {
      const error =
        "Channel must be set before connecting. Call joinChannel(channel) first.";
      console.error(`[Erebus:${instanceId}] ${error}`);
      console.error("Connect failed - no channel set");
      throw new Error(error);
    }

    // Channel is guaranteed to be set in constructor, no need to check
    this.#stateManager.clearProcessedMessages();
    // Debounce open
    return this.#debounceOpenConnection(timeout);
  }

  // joinChannel method removed - channel is set in constructor

  /**
   * Join a channel for this client instance
   * @param channel The channel to join
   */
  joinChannel(channel: string): void {
    const instanceId = this.#conn.connectionId;
    console.log(`[Erebus:${instanceId}] Joining channel`, { channel });
    console.log("Erebus.joinChannel() called", { channel });

    if (
      !channel ||
      typeof channel !== "string" ||
      channel.trim().length === 0
    ) {
      const error = "Invalid channel: must be a non-empty string";
      console.error(`[Erebus:${instanceId}] ${error}`, { channel });
      console.error("Invalid channel", { channel });
      return;
    }

    if (this.#stateManager.getChannel() === channel) {
      console.log(`[Erebus:${instanceId}] Channel already joined`, {
        channel,
      });
      console.log("Channel already joined", { channel });
      return;
    }

    // Update both state manager and connection
    this.#stateManager.setChannel(channel);
    this.#conn.setChannel(channel);

    console.log(`[Erebus:${instanceId}] Channel joined successfully`, {
      channel,
    });
    console.log("Channel joined successfully", { channel });
  }

  subscribe(
    topic: string,
    handler: Handler,
    onAck?: SubscriptionCallback,
    timeoutMs: number = 3000,
  ): void {
    // Debounce it
    console.log("subscribe called", { topic, handler, onAck, timeoutMs });
    this.#debounceSubscribe(topic, handler, onAck, timeoutMs);
  }

  subscribeWithCallback(
    topic: string,
    handler: Handler,
    onAck?: SubscriptionCallback,
    timeoutMs?: number,
  ): void {
    const instanceId = this.#conn.connectionId;
    console.log(`[Erebus:${instanceId}] Subscribe called`, {
      topic,
      hasAckCallback: !!onAck,
      timeout: timeoutMs,
    });
    console.log("Erebus.subscribe() called", { topic });

    if (!this.#stateManager.channel) {
      const error =
        "Channel must be set before subscribing. Call joinChannel(channel) first.";
      console.error(`[Erebus:${instanceId}] ${error}`, { topic });
      console.error("Subscribe failed - no channel set", { topic });
      throw new Error(error);
    }

    // Channel is guaranteed to be set in constructor, no need to check
    if (!topic || typeof topic !== "string" || topic.trim().length === 0) {
      const error = "Invalid topic: must be a non-empty string";
      console.error(`[Erebus:${instanceId}] ${error}`, { topic });
      console.error("Invalid topic", { topic });
      throw new Error(error);
    }

    if (typeof handler !== "function") {
      const error = "Invalid handler: must be a function";
      console.error(`[Erebus:${instanceId}] ${error}`);
      console.error("Invalid handler", { handlerType: typeof handler });
      throw new Error(error);
    }

    this.#stateManager.addHandler(topic, handler);
    this.#stateManager.addPendingSubscription(topic);
    this.#conn.subscribeWithCallback(topic, onAck, timeoutMs);
  }

  unsubscribe(topic: string): void {
    this.unsubscribeWithCallback(topic);
  }

  unsubscribeWithCallback(
    topic: string,
    onAck?: SubscriptionCallback,
    timeoutMs?: number,
  ): void {
    const instanceId = this.#conn.connectionId;
    console.log(`[Erebus:${instanceId}] Unsubscribe called`, {
      topic,
      hasAckCallback: !!onAck,
      timeout: timeoutMs,
    });
    console.log("Unsubscribe function called", { topic });

    if (!topic || typeof topic !== "string" || topic.trim().length === 0) {
      const error = "Invalid topic: must be a non-empty string";
      console.error(`[Erebus:${instanceId}] ${error}`, { topic });
      console.error("Invalid topic", { topic });
      throw new Error(error);
    }

    const handlers = this.#stateManager.getHandlers(topic);
    if (!handlers || handlers.size === 0) {
      console.warn(
        `[Erebus:${instanceId}] No handler set found during unsubscribe`,
        { topic },
      );
      console.warn("No handler set found during unsubscribe", { topic });
      return;
    }

    this.#stateManager.clearHandlers(topic);
    this.#stateManager.removePendingSubscription(topic);
    this.#conn.unsubscribeWithCallback(topic, onAck, timeoutMs);
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
    timeoutMs = 3000,
  }: {
    topic: string;
    messageBody: string;
    onAck: AckCallback;
    timeoutMs?: number;
  }): Promise<string> {
    return this.#publishInternal(topic, messageBody, true, onAck, timeoutMs);
  }

  close(): void {
    const instanceId = this.#conn.connectionId;
    console.log(`[Erebus:${instanceId}] Close called`);
    console.log("Erebus.close() called");
    this.#conn.close();
  }

  /**
   * Check if all subscriptions are ready (for more accurate latency testing)
   * In a real implementation, this would wait for server acknowledgments
   */
  async waitForSubscriptionReadiness(timeoutMs: number = 1000): Promise<void> {
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const checkReadiness = (): void => {
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
    console.log(`[Erebus:${instanceId}] __debugSummary getter called`);
    console.log("Erebus.__debugSummary getter called");

    const counts: Record<string, number> = {};
    let handlerCount = 0;
    for (const topic of this.#stateManager.getTopicsWithHandlers()) {
      const n = this.#stateManager.getHandlerCountForTopic(topic);
      handlerCount += n;
      counts[topic] = n;
      console.log(`[Erebus:${instanceId}] Counting handlers for topic`, {
        topic,
        count: n,
      });
      console.log("Counting handlers for topic", {
        topic,
        count: n,
      });
    }
    console.log(`[Erebus:${instanceId}] __debugSummary returning`, {
      handlerCount,
      topics: Object.keys(counts),
      counts,
    });
    console.log("Erebus.__debugSummary returning", {
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
    console.log(`[Erebus:${instanceId}] __debugConn getter called`);
    console.log("Erebus.__debugConn getter called");
    return this.#conn;
  }

  // Getters
  get connectionState(): string {
    return this.#stateManager.connectionState;
  }

  get isConnected(): boolean {
    return this.#stateManager.isConnected;
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

  get hasError(): boolean {
    return this.#stateManager.hasError;
  }

  get error(): Error | null {
    return this.#stateManager.error;
  }

  get isReconnecting(): boolean {
    return this.#stateManager.isReconnecting;
  }

  get reconnectAttempts(): number {
    return this.#stateManager.reconnectAttempts;
  }

  /**
   * Register a presence handler for a specific topic
   * @param topic - The topic to listen for presence updates on
   * @param handler - The callback function to handle presence updates
   */
  onPresence(topic: string, handler: PresenceHandler): void {
    const instanceId = this.#conn.connectionId;
    console.log(`[Erebus:${instanceId}] onPresence called`, { topic });
    console.log("Erebus.onPresence() called", { topic });

    if (!topic || typeof topic !== "string" || topic.trim().length === 0) {
      const error = "Invalid topic: must be a non-empty string";
      console.error(`[Erebus:${instanceId}] ${error}`, { topic });
      console.error("Invalid topic for presence", { topic });
      throw new Error(error);
    }

    if (typeof handler !== "function") {
      const error = "Invalid handler: must be a function";
      console.error(`[Erebus:${instanceId}] ${error}`);
      console.error("Invalid presence handler", {
        handlerType: typeof handler,
      });
      throw new Error(error);
    }

    this.#conn.onPresence(topic, handler);
    console.log(
      `[Erebus:${instanceId}] Presence handler registered for topic`,
      {
        topic,
      },
    );
    console.log("Presence handler registered", { topic });
  }

  /**
   * Remove a presence handler for a specific topic
   * @param topic - The topic to remove the handler from
   * @param handler - The specific handler function to remove
   */
  offPresence(topic: string, handler: PresenceHandler): void {
    const instanceId = this.#conn.connectionId;
    console.log(`[Erebus:${instanceId}] offPresence called`, { topic });
    console.log("Erebus.offPresence() called", { topic });

    this.#conn.offPresence(topic, handler);
    console.log(`[Erebus:${instanceId}] Presence handler removed for topic`, {
      topic,
    });
    console.log("Presence handler removed", { topic });
  }

  /**
   * Remove all presence handlers for a specific topic
   * @param topic - The topic to clear all handlers for
   */
  clearPresenceHandlers(topic: string): void {
    const instanceId = this.#conn.connectionId;
    console.log(`[Erebus:${instanceId}] clearPresenceHandlers called`, {
      topic,
    });
    console.log("Erebus.clearPresenceHandlers() called", { topic });

    this.#conn.clearPresenceHandlers(topic);
    console.log(
      `[Erebus:${instanceId}] All presence handlers cleared for topic`,
      {
        topic,
      },
    );
    console.log("All presence handlers cleared", { topic });
  }

  /**
   * Check if the connection is readable (can receive messages)
   */
  get isReadable(): boolean {
    return this.#stateManager.isConnected;
  }

  /**
   * Check if the connection is writable (can send messages)
   */
  get isWritable(): boolean {
    return this.#stateManager.isConnected;
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
          void this.#conn.publishWithAck(actualMessageBody, onAck, timeoutMs);
        } else {
          this.#conn.publish(actualMessageBody);
        }
        resolve(clientMsgId);
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  #handleMessage(m: PacketEnvelope): void {
    const instanceId = this.#conn.connectionId;
    if (m.packetType !== "publish") {
      if (this.#debug) {
        console.log(`[Erebus:${instanceId}] Ignoring non-message packetType`, {
          packetType: m.packetType,
        });
      }
      return;
    }

    const messageId = m.payload?.id || "unknown";

    // Check for duplicate messages
    if (this.#stateManager.isMessageProcessed(messageId)) {
      if (this.#debug) {
        console.log(`[Erebus:${instanceId}] Skipping duplicate message`, {
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
        console.warn(`[Erebus:${instanceId}] No handlers found for topic`, {
          topic: m.payload?.topic,
        });
      }
      return;
    }

    for (const fn of handlers) {
      try {
        fn(m.payload, {
          topic: m.payload.topic,
          seq: m.payload.seq,
          ts: m.payload.sentAt.getTime(),
        });
      } catch (error) {
        if (this.#debug) {
          console.error(
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
