import type { SchemaMap, Topic } from "../utils/types";
import { z } from "zod";
import { ErebusError } from "@/service";
import { useTopic } from "../context/TopicContext";
import { useEffect, useState } from "react";

export function useChannel<S extends SchemaMap, K extends Topic<S>>(
  overrideTopic: K,
  schema: S,
) {
  const { client } = useTopic();
  const topic = overrideTopic;

  type PayloadT = z.infer<S[K]>;
  const [messages, setMessages] = useState<PayloadT[]>([]);

  useEffect(() => {
    client.subscribe(topic, (payload) => {
      setMessages((prev) => [...prev, payload as PayloadT]);
    });
  }, [client, topic]);

  const publish = (payload: PayloadT) => {
    const topicSchema = schema[topic];
    if (!topicSchema) {
      throw new ErebusError(`Schema for topic "${topic}" is not defined.`);
    }
    topicSchema.parse(payload);

    client.publish({
      topic,
      messageBody: JSON.stringify(payload),
    });
  };

  return { publish, messages };
}
