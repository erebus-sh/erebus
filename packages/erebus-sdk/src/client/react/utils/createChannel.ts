import type { Presence } from "@/client/core/types";
import { useChannelInternal } from "../hooks/useChannelInternal";
import type { SchemaMap, Topic } from "./types";

export function createChannel<S extends SchemaMap>(schema: S) {
  return function useChannelForSchema<K extends Topic<S>>(
    channelName: K,
    onPresence?: (presence: Presence) => void,
  ) {
    return useChannelInternal<S, K>({
      channelName,
      schema,
      onPresence: onPresence ?? (() => {}),
    });
  };
}
