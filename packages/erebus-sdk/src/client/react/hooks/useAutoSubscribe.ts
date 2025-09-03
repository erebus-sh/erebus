import { useEffect, useState } from "react";
import type { AnySchema, SubscribedData } from "../utils/types";
import { createParse } from "../utils/helpers";
import type { Presence, SubscriptionResponse } from "@/client/core/types";

// Primitive hook for automatic subscription management based on connection status
export function useAutoSubscribe<
  S extends Record<string, AnySchema>,
  C extends keyof S & string,
>(
  _schemas: S,
  subscribe: (
    topic: string,
    callback?: (data: SubscribedData<S, C>) => void,
    onPresence?: (presence: Presence) => void,
    onSubscriptionAck?: (response: SubscriptionResponse) => void,
  ) => Promise<(() => void) | void>,
  unsubscribe: (topic: string) => void,
  topic: string,
  isReady: boolean,
  currentStatus: "subscribed" | "unsubscribed" | "pending" | undefined,
  onPresence?: (presence: Presence) => void,
) {
  const [messages, setMessages] = useState<
    {
      data: SubscribedData<S, C>;
    }[]
  >([]);
  const [subscriptionError, setSubscriptionError] = useState<{
    code: string;
    message: string;
  } | null>(null);
  const parse = createParse(_schemas);
  useEffect(() => {
    let isSubscribed = false;
    let presenceCleanup: (() => void) | void;

    async function manageSubscription() {
      if (!isReady) {
        console.log("Connection not ready, skipping subscription");
        return;
      }

      if (currentStatus !== "unsubscribed") {
        console.log("Already subscribed or pending, skipping subscription");
        return;
      }

      console.log("Auto-subscribing to topic:", topic);
      try {
        presenceCleanup = await subscribe(
          topic,
          (message) => {
            // Ensure the parsed message is of type SubscribedData<S, C>
            setMessages((prev) => [...prev, { data: message }]);
          },
          onPresence,
          (response: SubscriptionResponse) => {
            if (response.success) {
              console.log(`Auto-subscription succeeded for topic: ${topic}`);
              setSubscriptionError(null);
            } else {
              console.error(
                `Auto-subscription failed for topic ${topic}:`,
                response.error,
              );
              setSubscriptionError(response.error);
            }
          },
        );
        isSubscribed = true;
      } catch (error) {
        console.error("Failed to auto-subscribe:", error);
        setSubscriptionError({
          code: "SUBSCRIPTION_ERROR",
          message:
            error instanceof Error ? error.message : "Failed to auto-subscribe",
        });
      }
    }

    manageSubscription();

    return () => {
      if (isSubscribed && typeof unsubscribe === "function") {
        console.log("Auto-unsubscribing from topic:", topic);
        unsubscribe(topic);
      }
      if (typeof presenceCleanup === "function") {
        try {
          presenceCleanup();
        } catch {}
      }
    };
  }, [
    isReady,
    currentStatus,
    subscribe,
    unsubscribe,
    topic,
    onPresence,
    _schemas,
    parse,
    messages,
  ]);

  return { messages, subscriptionError };
}
