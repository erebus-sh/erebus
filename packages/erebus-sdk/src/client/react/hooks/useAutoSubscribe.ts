import { useEffect } from "react";

// Primitive hook for automatic subscription management based on connection status
export function useAutoSubscribe(
  subscribe: (
    topic: string,
    callback?: (data: unknown) => void,
    onPresence?: (presence: {
      clientId: string;
      topic: string;
      timestamp: number;
    }) => void,
  ) => Promise<(() => void) | void>,
  unsubscribe: (topic: string) => void,
  topic: string,
  isReady: boolean,
  currentStatus: "subscribed" | "unsubscribed" | "pending" | undefined,
  onPresence?: (presence: {
    clientId: string;
    topic: string;
    timestamp: number;
  }) => void,
) {
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
        presenceCleanup = await subscribe(topic, undefined, onPresence);
        isSubscribed = true;
      } catch (error) {
        console.error("Failed to auto-subscribe:", error);
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
  }, [isReady, currentStatus, subscribe, unsubscribe, topic, onPresence]);
}
