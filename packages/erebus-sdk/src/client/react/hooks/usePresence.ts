"use client";

import { useStore } from "zustand";
import { useRoomContext } from "../provider/RoomProvider";
import type { AnySchema } from "../utils/types";
import type { Presence } from "@/client/core/types";

// Stable empty presence map to avoid new object references per render
const EMPTY_PRESENCE: Record<string, Presence> = Object.freeze({});

export function usePresence<
  S extends Record<string, AnySchema> = Record<string, never>,
>(topic: string) {
  const { store } = useRoomContext<S>();

  // Get presence for this specific topic
  const presence = useStore(
    store,
    (state) => state.presence[topic] ?? EMPTY_PRESENCE,
  );

  // Get presence as array for easier iteration - properly typed
  const presenceList: Presence[] = Object.values(presence);

  // Get online users count
  const onlineCount = presenceList.filter(
    (p: Presence) => p.status === "online",
  ).length;

  // Get all unique client IDs
  const clientIds = Object.keys(presence);

  return {
    presence, // Object: clientId -> Presence
    presenceList, // Array: Presence[]
    onlineCount,
    clientIds,

    // Helper functions
    isOnline: (clientId: string) => presence[clientId]?.status === "online",
    getPresence: (clientId: string) => presence[clientId] || null,
  };
}
