"use client";

import { useStore } from "zustand";
import { useRoomContext } from "../provider/RoomProvider";
import type { AnySchema } from "../utils/types";

export function useConnection<
  S extends Record<string, AnySchema> = Record<string, never>,
>() {
  const { store } = useRoomContext<S>();

  // Use Zustand's useStore hook to subscribe to state changes
  const connectionState = useStore(store, (state) => state.connectionState);
  const connectionDetails = useStore(store, (state) => state.connectionDetails);
  const error = useStore(store, (state) => state.error);
  const isReady = useStore(store, (state) => state.isReady());

  return {
    connectionState,
    isConnected: connectionDetails.isConnected,
    isReadable: connectionDetails.isReadable,
    isWritable: connectionDetails.isWritable,
    connectionId: connectionDetails.connectionId,
    latency: connectionDetails.latency,
    error,
    isReady,
  };
}
