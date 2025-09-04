import { create } from "zustand";

interface State {
  connected: boolean;
  ready: boolean;
  topics: string[];
  error: Error | null;
  setConnected: (connected: boolean) => void;
  setReady: (ready: boolean) => void;
  setTopics: (topics: string[]) => void;
  setError: (error: Error | null) => void;
}

export const useChannelStore = create<State>((set) => ({
  connected: false,
  ready: false,
  topics: [],
  error: null,
  setConnected: (connected: boolean) => set({ connected }),
  setReady: (ready: boolean) => set({ ready }),
  setTopics: (topics: string[]) => set({ topics }),
  setError: (error: Error | null) => set({ error }),
}));
