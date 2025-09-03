"use client";

import { useEffect, useCallback, useState } from "react";
import { useStore } from "zustand";
import { useRoomContext } from "../provider/RoomProvider";
import type { AnySchema } from "../utils/types";
import type { Presence, SubscriptionResponse } from "@/client/core/types";
import { z } from "zod";

export interface UseSubscribeOptions {
  onPresence?: (presence: Presence) => void;
  autoSubscribe?: boolean; // Default: true
  onSubscriptionAck?: (response: SubscriptionResponse) => void;
  onUnsubscribeAck?: (response: SubscriptionResponse) => void;
  subscriptionTimeoutMs?: number; // Default: 10000ms
}

export function useSubscribe<
  S extends Record<string, AnySchema>,
  C extends keyof S & string,
  T extends string = string,
>(topic: T, options: UseSubscribeOptions = {}) {
  const { store } = useRoomContext<S>();
  const {
    onPresence,
    autoSubscribe = true,
    onSubscriptionAck,
    onUnsubscribeAck,
    subscriptionTimeoutMs = 10000,
  } = options;

  const [subscriptionError, setSubscriptionError] = useState<{
    code: string;
    message: string;
  } | null>(null);

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

      // Create subscription ACK callback
      const subscriptionCallback = (response: SubscriptionResponse) => {
        if (response.success) {
          console.log(`Successfully subscribed to topic: ${topic}`);
          setSubscriptionError(null);
        } else {
          console.error(
            `Failed to subscribe to topic ${topic}:`,
            response.error,
          );
          setSubscriptionError(response.error);
          state.setSubscriptionState(topic, "error");
        }

        // Call user-provided callback if available
        if (onSubscriptionAck) {
          onSubscriptionAck(response);
        }
      };

      // Subscribe to messages with ACK callback
      client.subscribeWithCallback(
        topic,
        (msg: unknown) => {
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
        },
        subscriptionCallback,
        subscriptionTimeoutMs,
      );

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
      // Create unsubscribe ACK callback
      const unsubscribeCallback = (response: SubscriptionResponse) => {
        if (response.success) {
          console.log(`Successfully unsubscribed from topic: ${topic}`);
        } else {
          console.error(
            `Failed to unsubscribe from topic ${topic}:`,
            response.error,
          );
          // Note: We don't set subscription error state for unsubscribe failures
          // since the client-side unsubscription already happened
        }

        // Call user-provided callback if available
        if (onUnsubscribeAck) {
          onUnsubscribeAck(response);
        }
      };

      client.unsubscribeWithCallback(
        topic,
        unsubscribeCallback,
        subscriptionTimeoutMs,
      );
      state.clearSubscription(topic);
      state.clearPresence(topic);
      console.log(`Unsubscribe request sent for topic: ${topic}`);
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
    subscriptionError,
    subscribe,
    unsubscribe,
    isReady,
  };
}
