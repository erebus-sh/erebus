import type { ErebusPubSubClient } from "./ErebusPubSubClient";
import type {
  AckCallback,
  Payload,
  SchemaMap,
  SubscriptionCallback,
  Topic,
} from "../types";

/**
 * ErebusPubSubSchemas
 *
 * A typed + runtime-validated facade over the raw PubSub client.
 *
 * - At compile-time: Payloads are enforced by TypeScript, inferred from the schema map.
 * - At runtime: Payloads are validated against the corresponding Zod schema before being
 *   published or after being received.
 *
 * This prevents accidental misuse (e.g. wrong fields, wrong types) and ensures
 * contract consistency between publisher and subscriber.
 */
export default class ErebusPubSubSchemas<TSchemas extends SchemaMap> {
  constructor(
    private readonly client: ErebusPubSubClient,
    private readonly schemas: TSchemas,
  ) {}

  /**
   * Publish a message to a topic.
   *
   * @param topic - The topic name (must exist in the schema map).
   * @param payload - The payload object (must conform to the schema for this topic).
   *
   * - First checks that the topic has a schema.
   * - Validates payload at runtime against the schema.
   * - Serializes payload to JSON before passing it to the raw client.
   */
  publish<K extends Topic<TSchemas>>(topic: K, payload: Payload<TSchemas, K>) {
    if (!this.schemas[topic]) {
      throw new Error(`Schema for topic ${topic} not found`);
    }
    this.schemas[topic].parse(payload); // runtime validation via Zod
    this.client.publish({
      topic,
      messageBody: JSON.stringify(payload),
    });
  }

  /**
   * Publish a message with acknowledgement handling.
   *
   * @param topic - The topic name (must exist in the schema map).
   * @param payload - The payload object (validated against schema).
   * @param onAck - Callback triggered once the message is acknowledged by the server.
   *
   * Same flow as `publish`, but with an ack hook.
   */
  publishWithAck<K extends Topic<TSchemas>>(
    topic: K,
    payload: Payload<TSchemas, K>,
    onAck: AckCallback,
  ) {
    if (!this.schemas[topic]) {
      throw new Error(`Schema for topic ${topic} not found`);
    }
    this.schemas[topic].parse(payload);
    this.client.publishWithAck({
      topic,
      messageBody: JSON.stringify(payload),
      onAck,
    });
  }

  /**
   * Subscribe to a topic and receive strongly-typed payloads.
   *
   * @param topic - The topic name (must exist in the schema map).
   * @param callback - Function that receives the validated payload object.
   * @param onAck - Optional callback invoked on subscription acknowledgement.
   *
   * - Ensures schema exists for the topic.
   * - Parses incoming raw JSON message into the correct payload type.
   * - Validates parsed object against the schema.
   * - Passes the validated payload to the callback.
   */
  subscribe<K extends Topic<TSchemas>>(
    topic: K,
    callback: (payload: Payload<TSchemas, K>) => void,
    onAck?: SubscriptionCallback,
  ) {
    if (!this.schemas[topic]) {
      throw new Error(`Schema for topic ${topic} not found`);
    }
    this.client.subscribe(
      topic,
      (raw) => {
        const parsed = JSON.parse(raw.payload) as Payload<TSchemas, K>;
        if (!this.schemas[topic]) {
          throw new Error(`Schema for topic ${topic} not found`);
        }
        this.schemas[topic].parse(parsed);
        callback(parsed);
      },
      onAck,
    );
  }

  /**
   * Unsubscribe from a topic.
   *
   * @param topic - The topic name to stop listening to.
   *
   * Simply delegates to the raw client.
   */
  unsubscribe<K extends Topic<TSchemas>>(topic: K) {
    this.client.unsubscribe(topic);
  }
}
