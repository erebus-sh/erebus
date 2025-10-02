import type { PacketEnvelope } from "@repo/schemas/packetEnvelope";

import type { MessageBody } from "../../../../../schemas/messageBody";
import type { AckCallback, SubscriptionCallback } from "../types";
import type { PresenceHandler } from "./Presence";
import { PubSubConnection } from "./PubSubConnection";
import { StateManager } from "./StateManager";
import type { ConnectionState, IPubSubClient } from "./interfaces";
import type { SubscribeOptions } from "./types";
import { createRpcClient } from "@repo/service/src/rpc";

type ErebusOptions = {
  wsUrl: string;
  httpBaseUrl?: string;
  tokenProvider: (channel: string) => Promise<string>;
  heartbeatMs?: number;
  log?: (l: "info" | "warn" | "error", msg: string, meta?: unknown) => void;
  debug?: boolean;
  connectionTimeoutMs?: number;
  subscriptionTimeoutMs?: number;
};

export type Handler = (
  payload: MessageBody,
  meta: { topic: string; seq: string; ts: number },
) => void;

/**
 * Refactored ErebusPubSub client using modular architecture
 */
export class ErebusPubSubClient
  implements IPubSubClient<string, string, MessageBody>
{
  #conn: PubSubConnection;
  #stateManager: StateManager;
  #debug: boolean;
  #rpcClient: ReturnType<typeof createRpcClient> | null = null;
  #httpBaseUrl: string | null = null;
  #tokenProvider: (channel: string) => Promise<string>;

  constructor(opts: ErebusOptions) {
    this.#debug = opts.debug ?? false;
    this.#tokenProvider = opts.tokenProvider;
    const instanceId = Math.random().toString(36).substring(2, 8);

    // Initialize RPC client if httpBaseUrl provided
    if (opts.httpBaseUrl) {
      this.#httpBaseUrl = opts.httpBaseUrl;
      this.#rpcClient = createRpcClient(opts.httpBaseUrl);
    }

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

  async connect(timeout?: number): Promise<void> {
    const instanceId = this.#conn.connectionId;
    console.log(`[Erebus:${instanceId}] Connect called`, { timeout });
    console.log("Erebus.connect() called");

    // Check if the client is already connected
    if (this.#stateManager.isConnected) {
      console.log(`[Erebus:${instanceId}] Already connected, returning`);
      return;
    }

    if (!this.#stateManager.channel) {
      const error =
        "Channel must be set before connecting. Call joinChannel(channel) first.";
      console.error(`[Erebus:${instanceId}] ${error}`);
      console.error("Connect failed - no channel set");
      throw new Error(error);
    }

    // Clear processed messages
    this.#stateManager.clearProcessedMessages();

    // Open connection (debounced)
    await this.#conn.open(timeout);

    // Wait for connection to be ready
    return new Promise((resolve, reject) => {
      console.log(
        "[Erebus.connect] Promise started: waiting for connection to be ready",
      );
      // Set timeout
      const connectionTimeoutId = setTimeout(() => {
        console.log("[Erebus.connect] Connection timeout reached");
        cleanup();
        reject(new Error(`Connection timeout after ${timeout || 30000}ms`));
      }, timeout || 30000);

      // Declare interval ID ahead of time to avoid temporal dead zone in cleanup()
      let checkIntervalId: ReturnType<typeof setInterval> | null = null;

      // Check connection state
      const checkConnection = (): void => {
        console.log("[Erebus.connect] Checking connection state", {
          isConnected: this.#stateManager.isConnected,
          hasError: this.#stateManager.hasError,
        });
        if (this.#stateManager.isConnected) {
          console.log(
            "[Erebus.connect] Connection established, resolving promise",
          );
          cleanup();
          resolve();
          return;
        }

        if (this.#stateManager.hasError) {
          console.log(
            "[Erebus.connect] Connection error detected, rejecting promise",
            {
              error: this.#stateManager.error,
            },
          );
          cleanup();
          reject(this.#stateManager.error || new Error("Connection failed"));
          return;
        }
      };

      // Check immediately and then every 100ms
      console.log("[Erebus.connect] Initial connection check");
      checkConnection();
      checkIntervalId = setInterval(() => {
        console.log("[Erebus.connect] Periodic connection check");
        checkConnection();
      }, 100);

      // Cleanup function
      function cleanup(): void {
        console.log("[Erebus.connect] Cleaning up connection wait resources");
        if (connectionTimeoutId) clearTimeout(connectionTimeoutId);
        if (checkIntervalId) clearInterval(checkIntervalId);
      }

      // Also resolve when connection state changes to open
      const originalSetConnectionState = this.#stateManager.setConnectionState; // eslint-disable-line @typescript-eslint/unbound-method
      this.#stateManager.setConnectionState = (
        state: ConnectionState,
      ): void => {
        console.log("[Erebus.connect] setConnectionState called", { state });
        originalSetConnectionState.call(this.#stateManager, state);
        if (state === "open") {
          console.log(
            "[Erebus.connect] Connection state is open, resolving promise",
          );
          cleanup();
          resolve();
        } else if (state === "error") {
          console.log(
            "[Erebus.connect] Connection state is error, rejecting promise",
            {
              error: this.#stateManager.error,
            },
          );
          cleanup();
          reject(this.#stateManager.error || new Error("Connection failed"));
        }
      };

      // Also listen for connection errors directly
      const originalSetError = this.#stateManager.setError; // eslint-disable-line @typescript-eslint/unbound-method
      this.#stateManager.setError = (error: Error): void => {
        console.log("[Erebus.connect] setError called", { error });
        originalSetError.call(this.#stateManager, error);
        cleanup();
        reject(error);
      };
    });
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

  // Overload for subscribe with options only
  subscribe<K extends string>(
    topic: K,
    handler: (message: MessageBody) => void,
    options?: SubscribeOptions,
  ): Promise<void>;
  // Overload for subscribe with onAck and options
  subscribe<K extends string>(
    topic: K,
    handler: (message: MessageBody) => void,
    onAck: SubscriptionCallback,
    options?: SubscribeOptions,
  ): Promise<void>;
  // Overload for subscribe with onAck, timeoutMs and options
  subscribe<K extends string>(
    topic: K,
    handler: (message: MessageBody) => void,
    onAck: SubscriptionCallback,
    timeoutMs: number,
    options?: SubscribeOptions,
  ): Promise<void>;
  // Implementation
  subscribe<K extends string>(
    topic: K,
    handler: (message: MessageBody) => void,
    onAckOrOptions?: SubscriptionCallback | SubscribeOptions,
    timeoutMsOrOptions?: number | SubscribeOptions,
    finalOptions?: SubscribeOptions,
  ): Promise<void> {
    let onAck: SubscriptionCallback | undefined;
    let timeoutMs: number = 10000;
    let opts: SubscribeOptions | undefined;

    if (typeof onAckOrOptions === "function") {
      // onAckOrOptions is onAck
      onAck = onAckOrOptions;

      if (typeof timeoutMsOrOptions === "number") {
        timeoutMs = timeoutMsOrOptions;
        opts = finalOptions;
      } else if (timeoutMsOrOptions && typeof timeoutMsOrOptions === "object") {
        opts = timeoutMsOrOptions as SubscribeOptions;
      }
    } else if (onAckOrOptions && typeof onAckOrOptions === "object") {
      // onAckOrOptions is options
      opts = onAckOrOptions as SubscribeOptions;
    }

    // Wrap handler to match internal Handler type
    const wrappedHandler: Handler = (payload, _meta) => {
      handler(payload);
    };

    this.subscribeWithCallback(topic, wrappedHandler, onAck, timeoutMs, opts);
    // Return a promise that resolves when subscription is ready
    return this.#stateManager.waitForSubscriptionReady(topic, timeoutMs);
  }

  subscribeWithCallback(
    topic: string,
    handler: Handler,
    onAck?: SubscriptionCallback,
    timeoutMs?: number,
    options?: SubscribeOptions,
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
    this.#stateManager.setSubscriptionStatus(topic, "pending");
    this.#conn.subscribeWithCallback(topic, onAck, timeoutMs, options);
  }

  unsubscribe<K extends string>(topic: K): void {
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

  publish<K extends string>(topic: K, payload: string): Promise<string> {
    return this.#publishInternal(topic, payload, false);
  }

  publishWithAck<K extends string>(
    topic: K,
    payload: string,
    onAck: AckCallback,
    timeoutMs: number = 3000,
  ): Promise<string> {
    return this.#publishInternal(topic, payload, true, onAck, timeoutMs);
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
   * Register a presence handler for a specific topic
   * @param topic - The topic to listen for presence updates on
   * @param handler - The callback function to handle presence updates
   */
  async onPresence<K extends string>(
    topic: K,
    handler: PresenceHandler,
  ): Promise<void> {
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

    // Debounce presence handler registration to prevent duplicate calls
    await this.registerPresenceHandler(topic, handler);
  }

  /**
   * Register a presence handler after ensuring subscription is ready
   */
  async registerPresenceHandler(
    topic: string,
    handler: PresenceHandler,
  ): Promise<void> {
    const instanceId = this.#conn.connectionId;
    console.log(`[Erebus:${instanceId}] registerPresenceHandler called`, {
      topic,
    });

    // Wait for subscription to be ready before registering presence handler
    try {
      await this.#stateManager.waitForSubscriptionReady(topic);
      this.#conn.onPresence(topic, handler);
      console.log(
        `[Erebus:${instanceId}] Presence handler registered for topic`,
        {
          topic,
        },
      );
    } catch (error) {
      console.error(
        `[Erebus:${instanceId}] Failed to register presence handler`,
        {
          topic,
          error,
        },
      );
      throw error;
    }
  }

  /**
   * Remove a presence handler for a specific topic
   * @param topic - The topic to remove the handler from
   * @param handler - The specific handler function to remove
   */
  offPresence<K extends string>(topic: K, handler: PresenceHandler): void {
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
  clearPresenceHandlers<K extends string>(topic: K): void {
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

  get isConnected(): boolean {
    return this.#stateManager.isConnected;
  }

  /**
   * Fetch message history for a topic with cursor-based pagination
   *
   * @param topic - Topic name to fetch history for
   * @param options - Pagination options (cursor, limit, direction)
   * @returns Promise resolving to paginated message history
   */
  async getHistory(
    topic: string,
    options?: {
      cursor?: string;
      limit?: number;
      direction?: "forward" | "backward";
    },
  ): Promise<{ items: MessageBody[]; nextCursor: string | null }> {
    if (!this.#rpcClient || !this.#httpBaseUrl) {
      throw new Error("HTTP base URL required for history API");
    }

    if (!this.#stateManager.channel) {
      throw new Error("Channel must be set before fetching history");
    }

    // Get current grant token
    const grant = await this.#tokenProvider(this.#stateManager.channel);

    // Build query params with proper typing (all params can be string or string[])
    const query = {
      grant,
      cursor: options?.cursor || "",
      limit: options?.limit?.toString() || "",
      direction: options?.direction || "",
    };

    // Call RPC client with properly typed query params
    const response = await this.#rpcClient.v1.pubsub.topics[
      ":topicName"
    ].history.$get({
      param: { topicName: topic },
      query,
    });

    if (!response.ok) {
      throw new Error(
        `History API failed: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as {
      items: MessageBody[];
      nextCursor: string | null;
    };
    return data;
  }

  /**
   * Create a paginated history iterator
   * Returns a function that fetches the next batch of messages
   *
   * @param topic - Topic name to fetch history for
   * @param options - Pagination options (limit, direction)
   * @returns Iterator function that returns next batch or null when exhausted
   *
   * @example
   * ```typescript
   * const getNext = client.createHistoryIterator("room-1", { limit: 50 });
   * const firstBatch = await getNext(); // { items: [...], hasMore: true }
   * const secondBatch = await getNext(); // { items: [...], hasMore: false }
   * const done = await getNext(); // null
   * ```
   */
  createHistoryIterator(
    topic: string,
    options?: {
      limit?: number;
      direction?: "forward" | "backward";
    },
  ): () => Promise<{ items: MessageBody[]; hasMore: boolean } | null> {
    let cursor: string | null = null;
    let exhausted = false;

    return async () => {
      if (exhausted) {
        return null;
      }

      const result = await this.getHistory(topic, {
        ...options,
        cursor: cursor || undefined,
      });

      cursor = result.nextCursor;
      exhausted = result.nextCursor === null;

      return {
        items: result.items,
        hasMore: !exhausted,
      };
    };
  }
}
