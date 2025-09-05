import { useChannel } from "../hooks/useChannel";
import type { SchemaMap, Topic } from "./types";

export function createChannel<S extends SchemaMap>(schema: S) {
  return function useChannelForTopic<K extends Topic<S>>(topic: K) {
    return useChannel<S, K>(topic, schema);
  };
}
