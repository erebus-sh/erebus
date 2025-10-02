import { ErebusPubSubClient } from "./ErebusPubSubClient";
import type {
  AckCallback,
  Payload,
  SchemaMap,
  SubscriptionCallback,
  Topic,
  MessageFor,
} from "../types";
import type { MessageBody } from "../../../../../schemas/messageBody";
import type { PresenceHandler } from "./Presence";
import type { SubscribeOptions } from "./types";

const mergeTopic = (topicSchema: string, topicSub: string) => {
  return `${topicSchema}_${topicSub}`;
};

/**
 * ErebusPubSubSchemas
 *
 * A composition-based typed facade around `ErebusPubSubClient` that enforces:
 * - Compile-time typing: Payloads are inferred from a provided Zod schema map
 * - Runtime validation: Payloads are validated with their Zod schema before
 *   publishing and after subscribing
 *
 * This guarantees contract consistency between publishers and subscribers and
 * prevents accidental misuse (wrong fields, wrong types, missing schema).
 *
 * Note: This facade wraps ErebusPubSubClient (which implements IPubSubClient).
 * The facade provides a different public API (split topics) for better type safety,
 * but internally calls the unified client interface after merging topics.
 */
class ErebusPubSubSchemas<TSchemas extends SchemaMap> {
  constructor(
    private readonly client: ErebusPubSubClient,
    private readonly schemas: TSchemas,
  ) {}

  /**
   * Publish a typed + validated message to a topic.
   */
  publish<K extends Topic<TSchemas>>(
    topicSchema: K,
    topicSub: string,
    payload: Payload<TSchemas, K>,
  ) {
    this.assertSchema(topicSchema, payload);
    const topic = mergeTopic(topicSchema, topicSub);
    return this.client.publish(topic, JSON.stringify(payload));
  }

  /**
   * Publish a typed + validated message with acknowledgement handling.
   */
  publishWithAck<K extends Topic<TSchemas>>(
    topicSchema: K,
    topicSub: string,
    payload: Payload<TSchemas, K>,
    onAck: AckCallback,
    timeoutMs?: number,
  ) {
    this.assertSchema(topicSchema, payload);
    const topic = mergeTopic(topicSchema, topicSub);
    return this.client.publishWithAck(
      topic,
      JSON.stringify(payload),
      onAck,
      timeoutMs,
    );
  }

  /**
   * Subscribe to a topic and receive strongly typed + validated payloads.
   */
  // Overload for subscribe with options only
  subscribe<K extends Topic<TSchemas>>(
    topicSchema: K,
    topicSub: string,
    callback: (message: MessageFor<TSchemas, K>) => void,
    options?: SubscribeOptions,
  ): Promise<void>;
  // Overload for subscribe with onAck and options
  subscribe<K extends Topic<TSchemas>>(
    topicSchema: K,
    topicSub: string,
    callback: (message: MessageFor<TSchemas, K>) => void,
    onAck: SubscriptionCallback,
    options?: SubscribeOptions,
  ): Promise<void>;
  // Overload for subscribe with onAck, timeoutMs and options
  subscribe<K extends Topic<TSchemas>>(
    topicSchema: K,
    topicSub: string,
    callback: (message: MessageFor<TSchemas, K>) => void,
    onAck: SubscriptionCallback,
    timeoutMs: number,
    options?: SubscribeOptions,
  ): Promise<void>;
  // Implementation
  subscribe<K extends Topic<TSchemas>>(
    topicSchema: K,
    topicSub: string,
    callback: (message: MessageFor<TSchemas, K>) => void,
    onAckOrOptions?: SubscriptionCallback | SubscribeOptions,
    timeoutMsOrOptions?: number | SubscribeOptions,
    options?: SubscribeOptions,
  ): Promise<void> {
    const schema = this.getSchema(topicSchema);
    const topic = mergeTopic(topicSchema, topicSub);

    const wrappedHandler = (message: MessageBody) => {
      const parsed = JSON.parse(message.payload) as Payload<TSchemas, K>;
      schema.parse(parsed);
      const typedMessage = {
        ...message,
        payload: parsed,
      } as MessageFor<TSchemas, K>;
      callback(typedMessage);
    };

    if (typeof onAckOrOptions === "function") {
      const onAck = onAckOrOptions;
      if (typeof timeoutMsOrOptions === "number") {
        return this.client.subscribe(
          topic,
          wrappedHandler,
          onAck,
          timeoutMsOrOptions,
          options,
        );
      }
      const finalOptions =
        timeoutMsOrOptions && typeof timeoutMsOrOptions === "object"
          ? (timeoutMsOrOptions as SubscribeOptions)
          : options;
      return this.client.subscribe(topic, wrappedHandler, onAck, finalOptions);
    }

    const finalOptions =
      onAckOrOptions && typeof onAckOrOptions === "object"
        ? (onAckOrOptions as SubscribeOptions)
        : options;
    return this.client.subscribe(topic, wrappedHandler, finalOptions);
  }

  /**
   * Unsubscribe from a topic.
   */
  unsubscribe<K extends Topic<TSchemas>>(topicSchema: K, topicSub: string) {
    const topic = mergeTopic(topicSchema, topicSub);
    this.client.unsubscribe(topic);
  }

  /**
   * Join a channel for this client instance.
   */
  joinChannel(channel: string) {
    this.client.joinChannel(channel);
  }

  /**
   * Connect the underlying client.
   */
  connect(timeout?: number) {
    return this.client.connect(timeout);
  }

  /**
   * Presence APIs passthroughs
   */
  onPresence<K extends Topic<TSchemas>>(
    topicSchema: K,
    topicSub: string,
    handler: PresenceHandler,
  ) {
    const topic = mergeTopic(topicSchema, topicSub);
    return this.client.onPresence(topic, handler);
  }

  offPresence<K extends Topic<TSchemas>>(
    topicSchema: K,
    topicSub: string,
    handler: PresenceHandler,
  ) {
    const topic = mergeTopic(topicSchema, topicSub);
    return this.client.offPresence(topic, handler);
  }

  clearPresenceHandlers<K extends Topic<TSchemas>>(
    topicSchema: K,
    topicSub: string,
  ) {
    const topic = mergeTopic(topicSchema, topicSub);
    return this.client.clearPresenceHandlers(topic);
  }

  close() {
    return this.client.close();
  }

  get isConnected() {
    return this.client.isConnected;
  }

  get isReadable() {
    return this.client.isReadable;
  }

  get isWritable() {
    return this.client.isWritable;
  }

  /**
   * Fetch message history for a topic with type safety
   *
   * @param topicSchema - Schema key for the topic
   * @param topicSub - Sub-topic identifier
   * @param options - Pagination options (cursor, limit, direction)
   * @returns Promise resolving to typed paginated messages
   */
  async getHistory<K extends Topic<TSchemas>>(
    topicSchema: K,
    topicSub: string,
    options?: {
      cursor?: string;
      limit?: number;
      direction?: "forward" | "backward";
    },
  ): Promise<{
    items: Array<MessageFor<TSchemas, K>>;
    nextCursor: string | null;
  }> {
    const topic = mergeTopic(topicSchema, topicSub);
    const result = await this.client.getHistory(topic, options);

    // Validate and transform items
    const schema = this.getSchema(topicSchema);
    const items = result.items.map((msg) => {
      const parsed = JSON.parse(msg.payload) as Payload<TSchemas, K>;
      schema.parse(parsed); // Runtime validation
      return {
        ...msg,
        payload: parsed,
      } as MessageFor<TSchemas, K>;
    });

    return {
      items,
      nextCursor: result.nextCursor,
    };
  }

  /**
   * Create a typed paginated history iterator
   * Returns a function that fetches the next batch with proper typing
   *
   * @param topicSchema - Schema key for the topic
   * @param topicSub - Sub-topic identifier
   * @param options - Pagination options (limit, direction)
   * @returns Iterator function that returns next batch or null when exhausted
   *
   * @example
   * ```typescript
   * const getNext = typed.createHistoryIterator("chat", "room-1", { limit: 50 });
   * const firstBatch = await getNext(); // { items: [...], hasMore: true }
   * const secondBatch = await getNext(); // { items: [...], hasMore: false }
   * const done = await getNext(); // null
   * ```
   */
  createHistoryIterator<K extends Topic<TSchemas>>(
    topicSchema: K,
    topicSub: string,
    options?: {
      limit?: number;
      direction?: "forward" | "backward";
    },
  ): () => Promise<{
    items: Array<MessageFor<TSchemas, K>>;
    hasMore: boolean;
  } | null> {
    const topic = mergeTopic(topicSchema, topicSub);
    const schema = this.getSchema(topicSchema);
    let cursor: string | null = null;
    let exhausted = false;

    return async () => {
      if (exhausted) {
        return null;
      }

      const result = await this.client.getHistory(topic, {
        ...options,
        cursor: cursor || undefined,
      });

      cursor = result.nextCursor;
      exhausted = result.nextCursor === null;

      // Validate and transform items
      const items = result.items.map((msg) => {
        const parsed = JSON.parse(msg.payload) as Payload<TSchemas, K>;
        schema.parse(parsed); // Runtime validation
        return {
          ...msg,
          payload: parsed,
        } as MessageFor<TSchemas, K>;
      });

      return {
        items,
        hasMore: !exhausted,
      };
    };
  }

  /**
   * Internal helper to check that a schema exists and payload is valid.
   */
  private assertSchema<K extends Topic<TSchemas>>(
    topicSchema: K,
    payload: Payload<TSchemas, K>,
  ) {
    const schema = this.getSchema(topicSchema);
    schema.parse(payload);
  }

  /**
   * Internal helper to retrieve schema or throw an error if missing.
   */
  private getSchema<K extends Topic<TSchemas>>(topicSchema: K) {
    const schema = this.schemas[topicSchema];
    if (!schema) {
      throw new Error(`Schema for topic "${topicSchema}" not found`);
    }
    return schema;
  }
}

export { ErebusPubSubSchemas };
