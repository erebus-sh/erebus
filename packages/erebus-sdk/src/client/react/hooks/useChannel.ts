import type { SchemaMap } from "../utils/types";
import { z } from "zod";
import { ErebusError } from "@/service";
import { useTopic } from "../context/TopicContext";

export function useChannel<K extends keyof S, S extends SchemaMap = SchemaMap>(
  channel: K,
) {
  const { client, topic, schema } = useTopic();

  type PayloadT = z.infer<S[K]>;

  const publish = (payload: PayloadT) => {
    // Ensure the topic exists in the schema and is defined
    const topicSchema = schema[channel];
    if (!topicSchema) {
      throw new ErebusError(
        `Schema for topic "${String(topic)}" is not defined.`,
      );
    }
    topicSchema.parse(payload); // runtime check

    // ErebusPubSubClient expects { topic: string, messageBody: string }
    // Serialize the payload to JSON string
    client.publish({
      topic: String(topic),
      messageBody: JSON.stringify(payload),
    });
  };

  return { publish };
}
