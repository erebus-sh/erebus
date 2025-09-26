import { ErebusPubSubClient } from "./ErebusPubSubClient";
import type {
  AckCallback,
  Payload,
  SchemaMap,
  SubscriptionCallback,
  Topic,
} from "../types";
import type { PresenceHandler } from "./Presence";

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
 */
class ErebusPubSubSchemas<TSchemas extends SchemaMap> {
  constructor(
    private readonly client: ErebusPubSubClient,
    private readonly schemas: TSchemas,
  ) {}

  /**
   * Publish a typed + validated message to a topic.
   */
  publish<K extends Topic<TSchemas>>(topic: K, payload: Payload<TSchemas, K>) {
    this.assertSchema(topic, payload);
    return this.client.publish({
      topic,
      messageBody: JSON.stringify(payload),
    });
  }

  /**
   * Publish a typed + validated message with acknowledgement handling.
   */
  publishWithAck<K extends Topic<TSchemas>>(
    topic: K,
    payload: Payload<TSchemas, K>,
    onAck: AckCallback,
    timeoutMs?: number,
  ) {
    this.assertSchema(topic, payload);
    return this.client.publishWithAck({
      topic,
      messageBody: JSON.stringify(payload),
      onAck,
      timeoutMs,
    });
  }

  /**
   * Subscribe to a topic and receive strongly typed + validated payloads.
   */
  subscribe<K extends Topic<TSchemas>>(
    topic: K,
    callback: (payload: Payload<TSchemas, K>) => void,
    onAck?: SubscriptionCallback,
    timeoutMs?: number,
  ) {
    const schema = this.getSchema(topic);
    return this.client.subscribe(
      topic,
      (message) => {
        const parsed = JSON.parse(message.payload) as Payload<TSchemas, K>;
        schema.parse(parsed);
        callback(parsed);
      },
      onAck,
      timeoutMs,
    );
  }

  /**
   * Unsubscribe from a topic.
   */
  unsubscribe<K extends Topic<TSchemas>>(topic: K) {
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
  onPresence<K extends Topic<TSchemas>>(topic: K, handler: PresenceHandler) {
    return this.client.onPresence(topic, handler);
  }

  offPresence<K extends Topic<TSchemas>>(topic: K, handler: PresenceHandler) {
    return this.client.offPresence(topic, handler);
  }

  clearPresenceHandlers<K extends Topic<TSchemas>>(topic: K) {
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
   * Internal helper to check that a schema exists and payload is valid.
   */
  private assertSchema<K extends Topic<TSchemas>>(
    topic: K,
    payload: Payload<TSchemas, K>,
  ) {
    const schema = this.getSchema(topic);
    schema.parse(payload);
  }

  /**
   * Internal helper to retrieve schema or throw an error if missing.
   */
  private getSchema<K extends Topic<TSchemas>>(topic: K) {
    const schema = this.schemas[topic];
    if (!schema) {
      throw new Error(`Schema for topic "${topic}" not found`);
    }
    return schema;
  }
}

export { ErebusPubSubSchemas };
