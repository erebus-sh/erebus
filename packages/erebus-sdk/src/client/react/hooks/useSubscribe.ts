"use client";

import { useEffect, useCallback } from "react";
import { useStore } from "zustand";
import { useRoomContext } from "../provider/RoomProvider";
import type { AnySchema } from "../utils/types";
import type { Presence } from "@/client/core/types";
import { z } from "zod";

export interface UseSubscribeOptions {
  onPresence?: (presence: Presence) => void;
  autoSubscribe?: boolean; // Default: true
}

export function useSubscribe<
  S extends Record<string, AnySchema>,
  C extends keyof S & string,
  T extends string = string,
>(topic: T, options: UseSubscribeOptions = {}) {
  const { store } = useRoomContext<S>();
  const { onPresence, autoSubscribe = true } = options;

  // Get subscription state and messages for this topic
  const subscriptionState = useStore(store, (state) =>
    state.getSubscriptionState(topic),
  );
  const messages = useStore(store, (state) => state.getTopicMessages(topic));
  const isReady = useStore(store, (state) => state.isReady());

  // Subscribe function
  const subscribe = useCallback(async () => {
    const state = store.getState();
    const client = state.client;

    if (!client || !state.isReady()) {
      throw new Error("Client not ready for subscription");
    }

    if (state.getSubscriptionState(topic) !== "unsubscribed") {
      console.log(`Already subscribed or subscribing to topic: ${topic}`);
      return;
    }

    console.log(`Subscribing to topic: ${topic}`);
    state.setSubscriptionState(topic, "subscribing");

    try {
      // Set up presence handling if callback provided
      let presenceCleanup: (() => void) | undefined;
      if (onPresence) {
        const cleanup = state.addPresenceCallback(topic, onPresence);
        presenceCleanup = cleanup;

        // Register with client
        client.onPresence(topic, (presence: Presence) => {
          state.setPresence(topic, presence.clientId, presence);
          // Trigger all callbacks for this topic
          const callbacks = state.onPresenceCallbacks[topic] || [];
          callbacks.forEach((cb) => cb(presence));
        });
      }

      // Subscribe to messages
      client.subscribe(topic, (msg: unknown) => {
        console.log(`Received message on topic ${topic}:`, msg);

        // Parse payload based on channel schema
        const messageData = msg as {
          id: string;
          topic: string;
          senderId: string;
          seq: string;
          sentAt: number;
          payload: unknown;
        };

        let parsed = messageData.payload;
        if (typeof messageData.payload === "string") {
          try {
            parsed = JSON.parse(messageData.payload);
          } catch {
            // Keep as string if JSON parsing fails
          }
        }

        const message = {
          id: messageData.id,
          topic: messageData.topic,
          senderId: messageData.senderId,
          seq: messageData.seq,
          sentAt: new Date(messageData.sentAt),
          payload: parsed,
        };

        state.addIncomingMessage(topic, message);
      });

      state.setSubscriptionState(topic, "subscribed");
      console.log(`Successfully subscribed to topic: ${topic}`);

      return presenceCleanup;
    } catch (error) {
      console.error(`Failed to subscribe to topic ${topic}:`, error);
      state.setSubscriptionState(topic, "error");
      throw error;
    }
  }, [topic, onPresence]);

  // Unsubscribe function
  const unsubscribe = useCallback(() => {
    const state = store.getState();
    const client = state.client;

    if (!client) {
      console.warn("No client available for unsubscribe");
      return;
    }

    if (state.getSubscriptionState(topic) === "unsubscribed") {
      console.log(`Already unsubscribed from topic: ${topic}`);
      return;
    }

    console.log(`Unsubscribing from topic: ${topic}`);

    try {
      client.unsubscribe(topic);
      state.clearSubscription(topic);
      state.clearPresence(topic);
      console.log(`Successfully unsubscribed from topic: ${topic}`);
    } catch (error) {
      console.error(`Failed to unsubscribe from topic ${topic}:`, error);
    }
  }, [topic]);

  // Auto-subscribe effect (run on mount/when topic or readiness changes)
  useEffect(() => {
    if (!autoSubscribe || !isReady) return;

    const state = store.getState();
    if (state.getSubscriptionState(topic) === "unsubscribed") {
      subscribe().catch(console.error);
    }

    // Cleanup only on unmount or when topic/autoSubscribe changes
    return () => {
      if (autoSubscribe) {
        unsubscribe();
      }
    };
  }, [autoSubscribe, isReady, topic]);

  return {
    messages: messages as Array<{
      id: string;
      topic: string;
      senderId: string;
      seq: string;
      sentAt: Date;
      payload: z.infer<S[C]>;
    }>,
    subscriptionState,
    subscribe,
    unsubscribe,
    isReady,
  };
}
