"use client";

import type { SchemaMap, Topic } from "../utils/types";
import { z } from "zod";
import { ErebusError } from "@/service";
import { useTopic } from "../context/TopicContext";
import { useEffect, useState, useCallback, useRef } from "react";
import { joinAndConnect } from "../utils/helpers";
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
  localId: string;
  status: SentMessageStatus;
  error: ErebusError | null;
};

type Message<T> = ReceivedMessage<T> | SentMessage<T>;
/**
 * Props for the internal useChannel hook.
 */
interface UseChannelInternalProps<S extends SchemaMap, K extends Topic<S>> {
  channelName: K;
  schema: S;
  onPresence?: (presence: Presence) => void;
}

/**
 * Simplified internal hook to use a channel
 */
export function useChannelInternal<S extends SchemaMap, K extends Topic<S>>({
  channelName,
  schema,
  onPresence,
}: UseChannelInternalProps<S, K>) {
  const { client, topic } = useTopic();

  type PayloadT = z.infer<S[K]>;
  type MessageT = Message<PayloadT>;

  const [messages, setMessages] = useState<MessageT[]>([]);
  const [isError, setIsError] = useState<boolean>(false);
  const [error, setError] = useState<ErebusError | null>(null);
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);

  // Use ref to store latest onPresence function to avoid re-subscription loops
  const onPresenceRef = useRef(onPresence);
  onPresenceRef.current = onPresence;

  // Helper to update sent message status
  const updateSentMessageStatus = useCallback(
    (
      localId: string,
      updates: Partial<Pick<SentMessage<PayloadT>, "status" | "error">>,
    ) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.type === "sent" && msg.localId === localId
            ? { ...msg, ...updates }
            : msg,
        ),
      );
    },
    [],
  );

  useEffect(() => {
    let isMounted = true;

    const setupSubscription = async () => {
      try {
        setIsError(false);
        setError(null);
        setIsConnecting(true);

        // Connect to client
        const { success, error } = await joinAndConnect(client, channelName);
        if (!success) {
          if (isMounted) {
            setIsError(true);
            setError(error);
            setIsConnecting(false);
          }
          return;
        }

        // Wait for connection
        let attempts = 0;
        while (attempts < 50 && !client.isConnected && isMounted) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          attempts++;
        }

        if (!isMounted) return;

        if (!client.isConnected) {
          setIsError(true);
          setError(new ErebusError("Connection timeout"));
          setIsConnecting(false);
          return;
        }

        setIsConnecting(false);

        // Subscribe to messages
        client.subscribe(
          topic,
          (msg) => {
            if (!isMounted) return;

            // Validate schema
            if (!schema[channelName]) {
              console.error(`Schema for channel "${channelName}" not defined`);
              return;
            }

            try {
              const parsedPayload = schema[channelName]!.parse(
                JSON.parse(msg.payload), // Payload is a string, but we need to parse it to an object
              ) as PayloadT;

              const receivedMessage: ReceivedMessage<PayloadT> = {
                ...msg,
                payload: parsedPayload,
                type: "received",
              };

              setMessages((prev) => [...prev, receivedMessage]);
            } catch (parseError) {
              console.error("Failed to parse message payload:", parseError);
            }
          },
          (ack) => {
            if (!isMounted) return;

            if (!ack.success) {
              setIsError(true);
              setError(new ErebusError("Subscription failed"));
              return;
            }

            setIsSubscribed(true);
          },
        );

        // Set up presence listener if callback provided
        if (onPresenceRef.current) {
          client.onPresence(topic, onPresenceRef.current);
        }
      } catch (err) {
        if (isMounted) {
          setIsConnecting(false);
          setIsError(true);
          setError(
            err instanceof ErebusError
              ? err
              : new ErebusError("Failed to setup subscription"),
          );
        }
      }
    };

    setupSubscription();

    return () => {
      isMounted = false;
      try {
        client.unsubscribe(topic);
        setIsSubscribed(false);
      } catch (error) {
        console.error("Error during cleanup:", error);
      }
    };
  }, [client, topic, channelName, schema]);

  const publish = useCallback(
    async (
      payload: PayloadT,
    ): Promise<{
      localId: string;
      success: boolean;
      error: ErebusError | null;
    }> => {
      // Validate payload
      if (!schema[channelName]) {
        throw new ErebusError(
          `Schema for channel "${channelName}" not defined`,
        );
      }
      schema[channelName].parse(payload);

      const localId = genId();

      // Create optimistic message
      const sentMessage: SentMessage<PayloadT> = {
        id: localId,
        topic,
        seq: "0",
        sentAt: new Date(),
        senderId: "local",
        payload,
        type: "sent",
        localId,
        status: "sending",
        error: null,
      };

      // Add optimistic message
      setMessages((prev) => [...prev, sentMessage]);

      try {
        await new Promise<void>((resolve, reject) => {
          client.publishWithAck({
            topic,
            messageBody: JSON.stringify(payload),
            onAck: (ack) => {
              if (ack.success) {
                updateSentMessageStatus(localId, { status: "sent" });
                resolve();
              } else {
                const err = new ErebusError("Publish failed");
                updateSentMessageStatus(localId, {
                  status: "failed",
                  error: err,
                });
                reject(err);
              }
            },
          });
        });

        return { localId, success: true, error: null };
      } catch (err) {
        const error =
          err instanceof ErebusError ? err : new ErebusError("Unknown error");
        return { localId, success: false, error };
      }
    },
    [client, topic, channelName, schema, updateSentMessageStatus],
  );

  return {
    publish,
    messages,
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
  };
}
