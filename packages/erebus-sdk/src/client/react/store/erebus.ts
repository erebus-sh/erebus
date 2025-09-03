import { createStore } from "zustand";
import { ErebusPubSubClientNew as ErebusPubSubClient } from "@/client/core/pubsub/ErebusPubSubClient";

export type ErebusState = {
  pubsub: ErebusPubSubClient | null;
  setPubsub: (pubsub: ErebusPubSubClient | null) => void;
};

export const useErebusStore = createStore<ErebusState>((set) => ({
  pubsub: null,
  setPubsub: (pubsub: ErebusPubSubClient | null) => set({ pubsub }),
}));
