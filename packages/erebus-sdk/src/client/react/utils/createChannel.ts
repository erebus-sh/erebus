import { useChannel } from "../hooks/useChannel";
import type { SchemaMap, Topic } from "./types";

export function createChannel<S extends SchemaMap>(schema: S) {
  return function useChannelForSchema<K extends Topic<S>>(channelName: K) {
    return useChannel<S, K>(channelName, schema);
  };
}
