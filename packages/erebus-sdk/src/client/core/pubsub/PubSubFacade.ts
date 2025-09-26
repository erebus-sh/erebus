import type { ErebusPubSubClient } from "./ErebusPubSubClient";
import type {
  AckCallback,
  Payload,
  SchemaMap,
  SubscriptionCallback,
  Topic,
} from "../types";

export default class ErebusPubSubSchemas<TSchemas extends SchemaMap> {
  constructor(
    private readonly client: ErebusPubSubClient,
    private readonly schemas: TSchemas,
  ) {}

  publish<K extends Topic<TSchemas>>(topic: K, payload: Payload<TSchemas, K>) {
    if (!this.schemas[topic]) {
      throw new Error(`Schema for topic ${topic} not found`);
    }
    this.schemas[topic].parse(payload); // runtime validate
    this.client.publish({
      topic,
      messageBody: JSON.stringify(payload),
    });
  }

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

  unsubscribe<K extends Topic<TSchemas>>(topic: K) {
    this.client.unsubscribe(topic);
  }
}
