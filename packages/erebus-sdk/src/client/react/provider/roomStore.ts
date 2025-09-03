"use client";

import { createStore } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { z } from "zod";
import type { AnySchema } from "../utils/types";
import type { AckResponse, Presence } from "@/client/core/types";

// Return a shared, stable empty messages array to avoid creating
// a new array reference on every selector run (prevents infinite loops)
const EMPTY_MESSAGES: Message<any>[] = [];

export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error";

export type SubscriptionState =
  | "unsubscribed"
  | "subscribing"
  | "subscribed"
  | "error";

export type MessageStatus = "sending" | "sent" | "error" | "timeout";

export interface ConnectionDetails {
  isConnected: boolean;
  isReadable: boolean;
  isWritable: boolean;
  connectionId: string | null;
  latency?: number;
}

export interface Message<T = any> {
  id: string;
  topic: string;
  senderId: string;
  seq: string;
  sentAt: Date;
  payload: T;
}

export interface OutgoingMessage {
  id: string;
  content: string;
  clientMsgId?: string;
  status: MessageStatus;
  timestamp: Date;
}

export interface RoomState<S extends Record<string, AnySchema>> {
  // Room info
  channel: string | null;
  schemas: S;
  client: any | null;

  // Connection state
  connectionState: ConnectionState;
  connectionDetails: ConnectionDetails;
  error: Error | null;

  // Topics and subscriptions
  subscriptions: Record<string, SubscriptionState>;
  topics: Record<string, Message<any>[]>; // Incoming messages by topic

  // Outgoing messages tracking
  outgoingMessages: OutgoingMessage[];

  // Presence tracking
  presence: Record<string, Record<string, Presence>>; // topic -> clientId -> presence

  // Callbacks
  onPresenceCallbacks: Record<string, ((presence: Presence) => void)[]>; // topic -> callbacks
  onAckCallbacks: Record<string, (ack: AckResponse) => void>; // clientMsgId -> callback
}

export interface RoomActions<S extends Record<string, AnySchema>> {
  // Setup
  setChannel: (channel: string) => void;
  setSchemas: (schemas: S) => void;
  setClient: (client: any) => void;

  // Connection management
  setConnectionState: (state: ConnectionState) => void;
  setConnectionDetails: (details: Partial<ConnectionDetails>) => void;
  setError: (error: Error | null) => void;

  // Subscription management
  setSubscriptionState: (topic: string, state: SubscriptionState) => void;
  clearSubscription: (topic: string) => void;

  // Message management
  addIncomingMessage: <T>(topic: string, message: Message<T>) => void;
  addOutgoingMessage: (content: string, status?: MessageStatus) => string;
  updateOutgoingMessage: (
    id: string,
    updates: Partial<OutgoingMessage>,
  ) => void;
  clearMessages: (topic?: string) => void;

  // Presence management
  setPresence: (topic: string, clientId: string, presence: Presence) => void;
  clearPresence: (topic: string, clientId?: string) => void;

  // Callback management
  addPresenceCallback: (
    topic: string,
    callback: (presence: Presence) => void,
  ) => () => void;
  addAckCallback: (
    clientMsgId: string,
    callback: (ack: AckResponse) => void,
  ) => void;
  removeAckCallback: (clientMsgId: string) => void;

  // Computed getters
  isReady: () => boolean;
  getTopicMessages: <C extends keyof S & string>(
    topic: string,
  ) => Message<z.infer<S[C]>>[];
  getSubscriptionState: (topic: string) => SubscriptionState;
}

export type RoomStore<S extends Record<string, AnySchema>> = ReturnType<
  typeof createRoomStore<S>
>;

// Export the store type directly for easier imports
export type RoomStoreType<S extends Record<string, AnySchema>> = RoomState<S> &
  RoomActions<S>;

export function createRoomStore<S extends Record<string, AnySchema>>(
  initialSchemas: S,
  initialChannel: string,
) {
  return createStore(
    subscribeWithSelector<RoomState<S> & RoomActions<S>>((set, get) => ({
      // Initial state
      channel: initialChannel,
      schemas: initialSchemas,
      client: null,

      connectionState: "disconnected",
      connectionDetails: {
        isConnected: false,
        isReadable: false,
        isWritable: false,
        connectionId: null,
      },
      error: null,

      subscriptions: {},
      topics: {},
      outgoingMessages: [],
      presence: {},
      onPresenceCallbacks: {},
      onAckCallbacks: {},

      // Actions
      setChannel: (channel) => set({ channel }),
      setSchemas: (schemas) => set({ schemas }),
      setClient: (client) => set({ client }),

      setConnectionState: (connectionState) => set({ connectionState }),
      setConnectionDetails: (details) =>
        set((state) => ({
          connectionDetails: { ...state.connectionDetails, ...details },
        })),
      setError: (error) => set({ error }),

      setSubscriptionState: (topic, state) =>
        set((current) => ({
          subscriptions: { ...current.subscriptions, [topic]: state },
        })),

      clearSubscription: (topic) =>
        set((current) => {
          const { [topic]: removed, ...remaining } = current.subscriptions;
          return { subscriptions: remaining };
        }),

      addIncomingMessage: (topic, message) =>
        set((current) => ({
          topics: {
            ...current.topics,
            [topic]: [...(current.topics[topic] || []), message],
          },
        })),

      addOutgoingMessage: (content, status = "sending") => {
        const id = `${Date.now()}-${Math.random()}`;
        const message: OutgoingMessage = {
          id,
          content,
          status,
          timestamp: new Date(),
        };

        set((current) => ({
          outgoingMessages: [...current.outgoingMessages, message],
        }));

        return id;
      },

      updateOutgoingMessage: (id, updates) =>
        set((current) => ({
          outgoingMessages: current.outgoingMessages.map((msg) =>
            msg.id === id ? { ...msg, ...updates } : msg,
          ),
        })),

      clearMessages: (topic) =>
        set((current) => ({
          topics: topic ? { ...current.topics, [topic]: [] } : {},
          outgoingMessages: topic ? current.outgoingMessages : [],
        })),

      setPresence: (topic, clientId, presence) =>
        set((current) => ({
          presence: {
            ...current.presence,
            [topic]: {
              ...current.presence[topic],
              [clientId]: presence,
            },
          },
        })),

      clearPresence: (topic, clientId) =>
        set((current) => {
          if (!clientId) {
            const { [topic]: removed, ...remaining } = current.presence;
            return { presence: remaining };
          }

          const topicPresence = current.presence[topic];
          if (!topicPresence) return current;

          const { [clientId]: removedClient, ...remainingClients } =
            topicPresence;
          return {
            presence: {
              ...current.presence,
              [topic]: remainingClients,
            },
          };
        }),

      addPresenceCallback: (topic, callback) => {
        set((current) => ({
          onPresenceCallbacks: {
            ...current.onPresenceCallbacks,
            [topic]: [...(current.onPresenceCallbacks[topic] || []), callback],
          },
        }));

        // Return cleanup function
        return () => {
          set((current) => ({
            onPresenceCallbacks: {
              ...current.onPresenceCallbacks,
              [topic]: (current.onPresenceCallbacks[topic] || []).filter(
                (cb) => cb !== callback,
              ),
            },
          }));
        };
      },

      addAckCallback: (clientMsgId, callback) =>
        set((current) => ({
          onAckCallbacks: {
            ...current.onAckCallbacks,
            [clientMsgId]: callback,
          },
        })),

      removeAckCallback: (clientMsgId) =>
        set((current) => {
          const { [clientMsgId]: removed, ...remaining } =
            current.onAckCallbacks;
          return { onAckCallbacks: remaining };
        }),

      // Computed getters
      isReady: () => {
        const state = get();
        return (
          state.connectionState === "connected" &&
          state.connectionDetails.isConnected &&
          state.connectionDetails.isReadable &&
          state.connectionDetails.isWritable
        );
      },

      getTopicMessages: (topic) => {
        return get().topics[topic] ?? EMPTY_MESSAGES;
      },

      getSubscriptionState: (topic) => {
        return get().subscriptions[topic] || "unsubscribed";
      },
    })),
  );
}
