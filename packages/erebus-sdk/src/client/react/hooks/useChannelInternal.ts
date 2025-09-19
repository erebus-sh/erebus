"use client";

import type { SchemaMap, Topic } from "../utils/types";
import { z } from "zod";
import { ErebusError } from "@/service";
import { useTopic } from "../context/TopicContext";
import { useEffect, useState } from "react";
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

  useEffect(() => {
    (async () => {
      const { success, error } = await joinAndConnect(client, channelName);
      if (!success) {
        setIsError(true);
        setError(error);
        return;
      }
      client.subscribe(
        topic,
        (msg) => {
          // msg.payload contains the payload, so we parse it
          if (!schema[channelName]) {
            throw new ErebusError(
              `Schema for channel "${channelName}" is not defined.`,
            );
          }
          const parsedPayload = schema[channelName].parse(
            msg.payload,
          ) as PayloadT;

          // Add as received message in chronological order
          const receivedMessage: ReceivedMessage<PayloadT> = {
            ...msg,
            payload: parsedPayload,
            type: "received",
          };

          setMessages((prev) => {
            // Insert in chronological order by sentAt
            const newMessages = [...prev, receivedMessage];
            return newMessages.sort(
              (a, b) => a.sentAt.getTime() - b.sentAt.getTime(),
            );
          });
        },
        (ack) => {
          console.log("[useChannelInternal] Subscription ACK", ack);
          if (!ack.success) {
            console.log("[useChannelInternal] Subscription ACK failed", ack);
            setIsError(true);
            if (ack.error.code === "TIMEOUT") {
              setError(
                new ErebusError(
                  "Subscription failed: the server could not process your request to subscribe to the specified topic due to a timeout.",
                ),
              );
              return;
            } else {
              console.log("[useChannelInternal] Subscription ACK failed", ack);
              setError(
                new ErebusError(
                  "Subscription failed: the server could not process your request to subscribe to the specified topic.",
                ),
              );
              return;
            }
          }
          console.log("[useChannelInternal] Subscription ACK success", ack);
          setIsSubscribed(true);
        },
      );

      client.onPresence(topic, (presence) => {
        console.log("[useChannelInternal] Received Presence", presence);
        setPresence((prev) => {
          /**
           * Update the presence map by setting the presence for the specific clientId.
           * This approach allows efficient updates and lookups for individual users,
           * rather than replacing the entire presence map each time.
           */
          return new Map(prev).set(presence.clientId, presence);
        });
        onPresence(presence);
      });
    })();

    return () => {
      try {
        client.unsubscribe(topic);
        setIsSubscribed(false);
      } catch {}
    };
  }, [client, topic]);

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

    // Add to messages array in chronological order
    setMessages((prev) => {
      const newMessages = [...prev, sentMessage];
      return newMessages.sort(
        (a, b) => a.sentAt.getTime() - b.sentAt.getTime(),
      );
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
    presence: [...presence.entries()],
  };
}
