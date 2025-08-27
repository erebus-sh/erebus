import { useEffect } from "react";

// Primitive hook for automatic subscription management based on connection status
export function useAutoSubscribe(
  subscribe: (topic: string) => Promise<(() => void) | void>,
  unsubscribe: (topic: string) => void,
  topic: string,
  isReady: boolean,
  currentStatus: "subscribed" | "unsubscribed" | "pending" | undefined,
) {
  useEffect(() => {
    let isSubscribed = false;

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
        await subscribe(topic);
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
    };
  }, [isReady, currentStatus, subscribe, unsubscribe, topic]);
}
