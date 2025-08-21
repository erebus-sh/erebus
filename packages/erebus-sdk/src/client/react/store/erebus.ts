import { createStore } from "zustand";
import { ErebusPubSubClient } from "@/client/core/pubsub/ErebusPubSub";

export type ErebusState = {
  pubsub: ErebusPubSubClient | null;
  setPubsub: (pubsub: ErebusPubSubClient | null) => void;
};

export const useErebusStore = createStore<ErebusState>((set) => ({
  pubsub: null,
  setPubsub: (pubsub: ErebusPubSubClient | null) => set({ pubsub }),
}));
