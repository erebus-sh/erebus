"use client";

import type { SchemaMap, Topic } from "../utils/types";
import { z } from "zod";
import { ErebusError } from "@/service";
import { useTopic } from "../context/TopicContext";
import { useEffect, useRef, useState } from "react";
import { joinAndConnect } from "../utils/helpers";
import type { PerMessageStatus, PublishOptions } from "../utils/publishStatus";
import { genId } from "../utils/id";
import type { MessageBody } from "@repo/schemas/messageBody";

export function useChannelInternal<S extends SchemaMap, K extends Topic<S>>(
  channelName: K,
  schema: S,
) {
  const { client, topic } = useTopic();
  // topic comes from TopicProvider (the conversation room)
  // channelName specifies which schema to use for validation

  type PayloadT = z.infer<S[K]>;
  type Message = Omit<MessageBody, "payload"> & { payload: PayloadT };
  const [messages, setMessages] = useState<Message[]>([]);
  const [isError, setIsError] = useState<boolean>(false);
  const [error, setError] = useState<ErebusError | null>(null);
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);

  /**
   * Track the status of each published message individually.
   *
   * Each message is processed asynchronously and maintains its own state,
   * including a local ID for reference. This allows us to display and update
   * the status of each message (e.g., sending, success, failed) independently,
   * rather than relying on a single global error state.
   *
   * We use a Map to store the status of each message by its ID.
   * When a status changes, we force a re-render to update the UI.
   */
  const statusRef = useRef<Map<string, PerMessageStatus>>(new Map());
  const [, forceRender] = useState(0); // Used to trigger a re-render when statuses change

  /**
   * Helper function to update the status of a specific message.
   * Mutates the status map and triggers a re-render.
   */
  const setMsgStatus = (id: string, patch: Partial<PerMessageStatus>) => {
    const prev = statusRef.current.get(id) ?? {
      id,
      status: "idle",
      attempts: 0,
      error: null,
    };
    statusRef.current.set(id, { ...prev, ...patch });
    forceRender((x) => x + 1);
  };

  // Expose a read-only snapshot for UI (optional)
  const getMessageStatus = (id: string) => statusRef.current.get(id);

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
          const parsedPayload = schema[channelName].parse(msg.payload);
          setMessages((prev) => [
            ...prev,
            { ...msg, payload: parsedPayload } as Message,
          ]);
        },
        (ack) => {
          if (!ack.success) {
            setIsError(true);
            if (ack.error.code === "TIMEOUT") {
              setError(
                new ErebusError(
                  "Subscription failed: the server could not process your request to subscribe to the specified topic due to a timeout.",
                ),
              );
              return;
            } else {
              setError(
                new ErebusError(
                  "Subscription failed: the server could not process your request to subscribe to the specified topic.",
                ),
              );
              return;
            }
          }
          setIsSubscribed(true);
        },
      );
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
    opts: PublishOptions = {},
  ): Promise<{
    id: string;
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

    const id = genId();
    const maxRetries = opts.maxRetries ?? 2;
    const baseDelay = opts.baseDelayMs ?? 250;

    setMsgStatus(id, { id, status: "sending", attempts: 0, error: null });

    let attempts = 0;

    const attemptOnce = () =>
      new Promise<void>((resolve, reject) => {
        attempts += 1;
        setMsgStatus(id, { attempts });

        client.publishWithAck({
          topic,
          messageBody: JSON.stringify(payload),
          onAck: (ack) => {
            if (ack.success) {
              setMsgStatus(id, { status: "success", error: null });
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
              setMsgStatus(id, { status: "failed", error: err });
              reject(err);
            }
          },
          // If your client supports an explicit per-send timeout, pass opts.timeoutMs here
        });
      });

    // Retry with exponential backoff (jitter optional)
    let lastErr: ErebusError | null = null;
    for (let i = 0; i <= maxRetries; i++) {
      try {
        await attemptOnce();
        return { id, success: true, attempts, error: null };
      } catch (e) {
        lastErr =
          e instanceof ErebusError
            ? e
            : new ErebusError("Unknown publish error");
        if (i < maxRetries) {
          const delay = baseDelay * Math.pow(2, i);
          await new Promise((r) => setTimeout(r, delay));
          // Mark as re-sending for UI clarity
          setMsgStatus(id, { status: "sending" });
        }
      }
    }

    // Exhausted retries
    setMsgStatus(id, { status: "failed", error: lastErr });
    return { id, success: false, attempts, error: lastErr };
  }

  return {
    publish, // returns Promise with per-message result
    messages,
    // expose status accessors so UI can show per-message chips/spinners
    getMessageStatus,
    // you can also expose a snapshot for quick mapping:
    messageStatuses: statusRef.current,
    isError,
    error,
    isSubscribed,
  };
}
