"use client";

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

type SubscriptionState = "subscribed" | "unsubscribed" | "pending";

type ChannelStatus = {
  // Connection status
  connectionState:
    | "disconnected"
    | "connecting"
    | "connected"
    | "reconnecting"
    | "error";
  isReady: boolean; // shorthand for connected + ready to pub/sub

  // Subscription tracking
  subscriptions: Record<string, SubscriptionState>;

  // Connection details
  isConnected: boolean;
  isReadable: boolean;
  isWritable: boolean;
  connectionId: string | null;
  latency: number | null;

  // Activity
  lastActivity: Date | null;

  // Error state
  hasError: boolean;
  lastError: Error | null;
};

type ChannelState = {
  channel: string | null;

  // Reactive status object - this is what users will consume
  status: ChannelStatus;

  // Legacy fields for internal use
  isConnected: boolean;
  isConnecting: boolean;
  isBeingSent: boolean;
  hasError: boolean;
  lastError: Error | null;
  retries: number;
  lastActivity: Date | null;
  connectionState:
    | "disconnected"
    | "connecting"
    | "connected"
    | "reconnecting"
    | "error";
  isReadable: boolean;
  isWritable: boolean;
  connectionId: string | null;
  lastPing: Date | null;
  lastPong: Date | null;
  latency: number | null;
  reconnectAttempts: number;
  maxReconnectAttempts: number;

  // Methods for updating state
  setChannel: (channel: string) => void;
  setConnected: (connected: boolean) => void;
  setConnecting: (connecting: boolean) => void;
  setBeingSent: (sending: boolean) => void;
  setError: (error: boolean, errorDetails?: Error | null) => void;
  incrementRetries: () => void;
  resetRetries: () => void;
  updateActivity: () => void;

  // Connection state methods
  setConnectionState: (state: ChannelState["connectionState"]) => void;
  setReadable: (readable: boolean) => void;
  setWritable: (writable: boolean) => void;
  setConnectionId: (id: string | null) => void;
  updatePing: () => void;
  updatePong: () => void;
  setLatency: (latency: number | null) => void;
  incrementReconnectAttempts: () => void;
  resetReconnectAttempts: () => void;
  setMaxReconnectAttempts: (max: number) => void;

  // New reactive subscription methods
  setSubscriptionStatus: (topic: string, status: SubscriptionState) => void;
  removeSubscription: (topic: string) => void;
  clearAllSubscriptions: () => void;

  // Internal method to sync the reactive status object
  _syncStatus: () => void;
};

const createInitialStatus = (): ChannelStatus => ({
  connectionState: "disconnected",
  isReady: false,
  subscriptions: {},
  isConnected: false,
  isReadable: false,
  isWritable: false,
  connectionId: null,
  latency: null,
  lastActivity: null,
  hasError: false,
  lastError: null,
});

export const useChannelState = create(
  subscribeWithSelector<ChannelState>((set, get) => ({
    channel: null,
    status: createInitialStatus(),

    // Legacy fields for internal use
    isConnected: false,
    isConnecting: false,
    isBeingSent: false,
    hasError: false,
    lastError: null,
    retries: 0,
    lastActivity: null,
    connectionState: "disconnected",
    isReadable: false,
    isWritable: false,
    connectionId: null,
    lastPing: null,
    lastPong: null,
    latency: null,
    reconnectAttempts: 0,
    maxReconnectAttempts: 5,

    // Basic setters that also sync reactive status
    setChannel: (channel) => {
      set({ channel });
      get()._syncStatus();
    },

    setConnected: (connected) => {
      set({ isConnected: connected });
      get()._syncStatus();
    },

    setConnecting: (connecting) => {
      set({ isConnecting: connecting });
      get()._syncStatus();
    },

    setBeingSent: (sending) => set({ isBeingSent: sending }),

    setError: (error, errorDetails) => {
      set({
        hasError: error,
        lastError: errorDetails ?? null,
      });
      get()._syncStatus();
    },

    incrementRetries: () => set((s) => ({ retries: s.retries + 1 })),
    resetRetries: () => set({ retries: 0 }),

    updateActivity: () => {
      const now = new Date();
      set({ lastActivity: now });
      get()._syncStatus();
    },

    // Connection state methods that sync reactive status
    setConnectionState: (state) => {
      set({ connectionState: state });
      get()._syncStatus();
    },

    setReadable: (readable) => {
      set({ isReadable: readable });
      get()._syncStatus();
    },

    setWritable: (writable) => {
      set({ isWritable: writable });
      get()._syncStatus();
    },

    setConnectionId: (id) => {
      set({ connectionId: id });
      get()._syncStatus();
    },

    updatePing: () => set({ lastPing: new Date() }),
    updatePong: () => set({ lastPong: new Date() }),

    setLatency: (latency) => {
      set({ latency });
      get()._syncStatus();
    },

    incrementReconnectAttempts: () =>
      set((s) => ({ reconnectAttempts: s.reconnectAttempts + 1 })),
    resetReconnectAttempts: () => set({ reconnectAttempts: 0 }),
    setMaxReconnectAttempts: (max) => set({ maxReconnectAttempts: max }),

    // New reactive subscription methods
    setSubscriptionStatus: (topic, status) => {
      const current = get().status.subscriptions[topic] ?? "unsubscribed";
      if (current === status) return;
      set((state) => ({
        status: {
          ...state.status,
          subscriptions: {
            ...state.status.subscriptions,
            [topic]: status,
          },
        },
      }));
    },

    removeSubscription: (topic) => {
      const exists = topic in get().status.subscriptions;
      if (!exists) return;
      set((state) => {
        const { [topic]: _removed, ...remainingSubscriptions } =
          state.status.subscriptions;
        return {
          status: {
            ...state.status,
            subscriptions: remainingSubscriptions,
          },
        };
      });
    },

    clearAllSubscriptions: () => {
      set((state) => ({
        status: {
          ...state.status,
          subscriptions: {},
        },
      }));
    },

    // Internal method to sync the reactive status object
    _syncStatus: () => {
      const state = get();
      const isReady = state.isConnected && state.isReadable && state.isWritable;

      set({
        status: {
          ...state.status,
          connectionState: state.connectionState,
          isReady,
          isConnected: state.isConnected,
          isReadable: state.isReadable,
          isWritable: state.isWritable,
          connectionId: state.connectionId,
          latency: state.latency,
          lastActivity: state.lastActivity,
          hasError: state.hasError,
          lastError: state.lastError,
        },
      });
    },
  })),
);
