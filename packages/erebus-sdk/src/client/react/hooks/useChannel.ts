import type { SchemaMap, Topic } from "../utils/types";
import { z } from "zod";
import { ErebusError } from "@/service";
import { useTopic } from "../context/TopicContext";
import { useEffect, useState } from "react";

export function useChannel<S extends SchemaMap, K extends Topic<S>>(
  channelName: K,
  schema: S,
) {
  const { client, topic } = useTopic();
  // topic comes from TopicProvider (the conversation room)
  // channelName specifies which schema to use for validation

  type PayloadT = z.infer<S[K]>;
  const [messages, setMessages] = useState<PayloadT[]>([]);

  useEffect(() => {
    // TODO: First of all, joinChannel and connect then thing about how we subscribe
    //       handle errors, and stuff like, that if you are allowed or not, throw errors
    //
    client.subscribe(topic, (payload) => {
      setMessages((prev) => [...prev, payload as PayloadT]);
    });
  }, [client, topic]);

  const publish = (payload: PayloadT) => {
    const channelSchema = schema[channelName];
    if (!channelSchema) {
      throw new ErebusError(
        `Schema for channel "${channelName}" is not defined.`,
      );
    }
    channelSchema.parse(payload);

    client.publish({
      topic,
      messageBody: JSON.stringify(payload),
    });
  };

  return { publish, messages };
}
