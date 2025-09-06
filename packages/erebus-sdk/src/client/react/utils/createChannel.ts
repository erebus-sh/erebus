import { useChannelInternal } from "../hooks/useChannelInternal";
import type { SchemaMap, Topic } from "./types";

export function createChannel<S extends SchemaMap>(schema: S) {
  return function useChannelForSchema<K extends Topic<S>>(channelName: K) {
    return useChannelInternal<S, K>(channelName, schema);
  };
}
