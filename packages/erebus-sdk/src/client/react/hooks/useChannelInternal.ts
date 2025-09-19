"use client";

import type { SchemaMap, Topic } from "../utils/types";
import { z } from "zod";
import { ErebusError } from "@/service";
import { useTopic } from "../context/TopicContext";
import { useEffect, useState, useCallback } from "react";
import { joinAndConnect } from "../utils/helpers";
import type { PublishOptions } from "../utils/publishStatus";
import { genId } from "../utils/id";
import type { MessageBody } from "../../../../../schemas/messageBody";
import type { Presence } from "@/client/core/types";

/**
 * Status for sent messages
 */
type SentMessageStatus = "sending" | "sent" | "failed";

/**
 * Discriminated union for messages with proper type safety
 */
type ReceivedMessage<T> = Omit<MessageBody, "payload"> & {
  type: "received";
  payload: T;
};

type SentMessage<T> = Omit<MessageBody, "payload"> & {
  type: "sent";
  payload: T;
  localId: string; // Always present for sent messages
  status: SentMessageStatus;
  attempts: number;
  error: ErebusError | null;
};

type Message<T> = ReceivedMessage<T> | SentMessage<T>;
/**
 * Props for the internal useChannel hook.
 *
 * @template S - The schema map for all channels.
 * @template K - The specific topic key within the schema map.
 * @property channelName - The name of the channel to subscribe to.
 * @property schema - The schema map for validation.
 * @property onPresence - Callback invoked when a presence event is received.
 */
interface UseChannelInternalProps<S extends SchemaMap, K extends Topic<S>> {
  channelName: K;
  schema: S;
  onPresence: (presence: Presence) => void;
}

/**
 * Internal hook to use a channel, used to infer the type of the payload
 *
 * @param channelName - The name of the channel to use
 * @param schema - The schema to use for validation
 * @param onPresence - The function to call when a presence event is received
 * @returns
 */
export function useChannelInternal<S extends SchemaMap, K extends Topic<S>>({
  channelName,
  schema,
  onPresence,
}: UseChannelInternalProps<S, K>) {
  const { client, topic } = useTopic();
  // topic comes from TopicProvider (the conversation room)
  // channelName specifies which schema to use for validation

  type PayloadT = z.infer<S[K]>;
  type MessageT = Message<PayloadT>;

  // Single array for all messages in chronological order
  const [messages, setMessages] = useState<MessageT[]>([]);
  const [isError, setIsError] = useState<boolean>(false);
  const [error, setError] = useState<ErebusError | null>(null);
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [presence, setPresence] = useState<Map<string, Presence>>(new Map());

  /**
   * Helper function to update the status of a sent message.
   * Finds the message in the array and updates its status inline.
   */
  const updateSentMessageStatus = (
    localId: string,
    updates: Partial<
      Pick<SentMessage<PayloadT>, "status" | "attempts" | "error">
    >,
  ) => {
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.type === "sent" && msg.localId === localId) {
          return { ...msg, ...updates };
        }
        return msg;
      }),
    );
  };

  /**
   * Helper function to insert a message in chronological order without sorting the entire array.
   * Uses binary search for O(log n) insertion instead of O(n log n) sorting.
   */
  const insertMessageInOrder = useCallback(
    (newMessage: MessageT, messages: MessageT[]): MessageT[] => {
      if (messages.length === 0) {
        return [newMessage];
      }

      const newMessageTime = newMessage.sentAt.getTime();

      // Binary search for insertion point
      let left = 0;
      let right = messages.length;

      while (left < right) {
        const mid = Math.floor((left + right) / 2);
        const midMessage = messages[mid];
        if (midMessage && midMessage.sentAt.getTime() < newMessageTime) {
          left = mid + 1;
        } else {
          right = mid;
        }
      }

      // Insert at the found position
      const result = [...messages];
      result.splice(left, 0, newMessage);
      return result;
    },
    [],
  );

  useEffect(() => {
    let isMounted = true;

    const setupSubscription = async (retryCount = 0) => {
      try {
        // Reset error state when attempting to connect
        setIsError(false);
        setError(null);
        setIsConnecting(true);

        const { success, error } = await joinAndConnect(client, channelName);
        if (!success) {
          console.log("[useChannelInternal] Join and connect failed", error);
          if (isMounted) {
            setIsError(true);
            setError(error);
            setIsConnecting(false);
          }
          return;
        }

        // Wait for connection with timeout and proper state checking
        const maxWaitTime = 5000; // 5 seconds max wait
        const checkInterval = 100; // Check every 100ms
        let waited = 0;

        while (waited < maxWaitTime && isMounted) {
          if (client.isConnected) {
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, checkInterval));
          waited += checkInterval;
        }

        if (!isMounted) {
          setIsConnecting(false);
          return;
        }

        if (!client.isConnected) {
          const timeoutError = new ErebusError(
            "Connection timeout: Unable to establish connection within the expected time.",
          );
          setIsError(true);
          setError(timeoutError);
          setIsConnecting(false);
          return;
        }

        setIsConnecting(false);

        console.log("[useChannelInternal] Subscribing to topic", topic);

        // Subscribe to messages
        client.subscribe(
          topic,
          (msg) => {
            if (!isMounted) return;

            console.log("[useChannelInternal] Received message", msg);

            // Validate schema exists
            if (!schema[channelName]) {
              console.error(
                `Schema for channel "${channelName}" is not defined.`,
              );
              return;
            }

            try {
              const parsedPayload = schema[channelName]!.parse(
                msg.payload,
              ) as PayloadT;

              const receivedMessage: ReceivedMessage<PayloadT> = {
                ...msg,
                payload: parsedPayload,
                type: "received",
              };

              setMessages((prev) => {
                // Insert in chronological order efficiently using binary search
                return insertMessageInOrder(receivedMessage, prev);
              });
            } catch (parseError) {
              console.error(
                "[useChannelInternal] Failed to parse message payload",
                parseError,
              );
            }
          },
          (ack) => {
            if (!isMounted) return;

            console.log("[useChannelInternal] Subscription ACK", ack);

            if (!ack.success) {
              console.log("[useChannelInternal] Subscription ACK failed", ack);
              setIsError(true);

              const errorMessage =
                ack.error?.code === "TIMEOUT"
                  ? "Subscription failed: the server could not process your request to subscribe to the specified topic due to a timeout."
                  : "Subscription failed: the server could not process your request to subscribe to the specified topic.";

              setError(new ErebusError(errorMessage));
              return;
            }

            console.log("[useChannelInternal] Subscription ACK success", ack);
            setIsSubscribed(true);
          },
        );

        // Set up presence listener
        client.onPresence(topic, (presence) => {
          if (!isMounted) return;

          console.log("[useChannelInternal] Received Presence", presence);
          setPresence((prev) => {
            // Update the presence map efficiently
            return new Map(prev).set(presence.clientId, presence);
          });
          onPresence(presence);
        });
      } catch (error) {
        if (isMounted) {
          console.error("[useChannelInternal] Setup error", error);
          setIsConnecting(false);

          // Retry logic for transient errors
          if (retryCount < 2) {
            console.log(
              `[useChannelInternal] Retrying setup (attempt ${retryCount + 1}/3)`,
            );
            setTimeout(
              () => {
                if (isMounted) {
                  setupSubscription(retryCount + 1);
                }
              },
              Math.pow(2, retryCount) * 1000,
            ); // Exponential backoff
            return;
          }

          setIsError(true);
          setError(
            error instanceof ErebusError
              ? error
              : new ErebusError(
                  "Failed to setup subscription after multiple attempts",
                ),
          );
        }
      }
    };

    setupSubscription();

    return () => {
      isMounted = false;

      try {
        console.log("[useChannelInternal] Unsubscribing from topic", topic);
        client.unsubscribe(topic);
        setIsSubscribed(false);
      } catch (error) {
        console.error("[useChannelInternal] Error during cleanup", error);
      }
    };
  }, [client, topic, channelName, schema, onPresence]);

  async function publish(
    payload: PayloadT,
    opts: PublishOptions = {
      withAck: true,
    },
  ): Promise<{
    localId: string;
    success: boolean;
    attempts: number;
    error: ErebusError | null;
  }> {
    // Validate before sending
    if (!schema[channelName]) {
      throw new ErebusError(
        `Schema for channel "${channelName}" is not defined.`,
      );
    }
    schema[channelName].parse(payload);

    const localId = genId();
    const maxRetries = opts.maxRetries ?? 2;
    const baseDelay = opts.baseDelayMs ?? 250;

    // Create sent message immediately for optimistic UI
    const sentMessage: SentMessage<PayloadT> = {
      id: localId, // Use localId as temporary ID
      topic, // Use the current topic
      seq: "0", // Will be updated when we get the real message
      sentAt: new Date(),
      senderId: "unknown", // Will be updated when we get the real message
      payload,
      type: "sent",
      localId,
      status: "sending",
      attempts: 0,
      error: null,
    };

    // Add to messages array in chronological order using optimized insertion
    setMessages((prev) => {
      return insertMessageInOrder(sentMessage, prev);
    });

    let attempts = 0;

    const attemptOnce = () =>
      new Promise<void>((resolve, reject) => {
        attempts += 1;
        updateSentMessageStatus(localId, { attempts });

        if (opts.withAck) {
          client.publishWithAck({
            topic,
            messageBody: JSON.stringify(payload),
            onAck: (ack) => {
              if (ack.success) {
                updateSentMessageStatus(localId, {
                  status: "sent",
                  error: null,
                });
                resolve();
              } else {
                const code = ack.error?.code ?? "UNKNOWN";
                const err =
                  code === "TIMEOUT"
                    ? new ErebusError(
                        "Publish failed: the server timed out processing your publish request.",
                      )
                    : new ErebusError(
                        "Publish failed: the server could not process your publish request.",
                      );
                updateSentMessageStatus(localId, {
                  status: "failed",
                  error: err,
                });
                reject(err);
              }
            },
            // If your client supports an explicit per-send timeout, pass opts.timeoutMs here
          });
        } else {
          client.publish({
            topic,
            messageBody: JSON.stringify(payload),
          });
          // For fire-and-forget, mark as sent immediately
          updateSentMessageStatus(localId, { status: "sent" });
          resolve();
        }
      });

    // Retry with exponential backoff (jitter optional)
    let lastErr: ErebusError | null = null;
    for (let i = 0; i <= maxRetries; i++) {
      try {
        await attemptOnce();
        return { localId, success: true, attempts, error: null };
      } catch (e) {
        lastErr =
          e instanceof ErebusError
            ? e
            : new ErebusError("Unknown publish error");
        if (i < maxRetries) {
          const delay = baseDelay * Math.pow(2, i);
          await new Promise((r) => setTimeout(r, delay));
          // Mark as re-sending for UI clarity
          updateSentMessageStatus(localId, { status: "sending" });
        }
      }
    }

    // Exhausted retries
    updateSentMessageStatus(localId, { status: "failed", error: lastErr });
    return { localId, success: false, attempts, error: lastErr };
  }

  return {
    publish, // returns Promise with per-message result
    messages, // Chronologically ordered messages with discriminated union
    // Helper functions for filtering if needed
    sentMessages: messages.filter(
      (msg): msg is SentMessage<PayloadT> => msg.type === "sent",
    ),
    receivedMessages: messages.filter(
      (msg): msg is ReceivedMessage<PayloadT> => msg.type === "received",
    ),
    isError,
    error,
    isSubscribed,
    isConnecting,
    presence: [...presence.entries()],
  };
}
