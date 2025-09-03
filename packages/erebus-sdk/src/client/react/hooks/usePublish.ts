"use client";

import { useCallback } from "react";
import { useRoomContext } from "../provider/RoomProvider";
import type { AnySchema } from "../utils/types";
import type { AckResponse } from "@/client/core/types";
import { z } from "zod";

export interface PublishOptions {
  onAck?: (ack: AckResponse) => void;
  timeout?: number; // Default: 5000ms
  trackInUI?: boolean; // Default: false
  messageContent?: string; // For UI tracking
}

export function usePublish<
  S extends Record<string, AnySchema>,
  C extends keyof S & string,
>() {
  const { store } = useRoomContext<S>();

  // Simple publish (fire and forget)
  const publish = useCallback(
    (topic: string, payload: z.infer<S[C]>) => {
      const state = store.getState();
      const client = state.client;

      if (!client || !state.isReady()) {
        throw new Error("Client not ready for publishing");
      }

      const stringifiedPayload = JSON.stringify(payload);
      console.log(`Publishing to topic "${topic}":`, payload);

      client.publish({
        topic,
        messageBody: stringifiedPayload,
      });
    },
    [store],
  );

  // Publish with acknowledgment
  const publishWithAck = useCallback(
    async (
      topic: string,
      payload: z.infer<S[C]>,
      options: PublishOptions = {},
    ): Promise<{
      clientMsgId: string;
      status: "sent" | "error" | "timeout";
    }> => {
      const {
        onAck,
        timeout = 5000,
        trackInUI = false,
        messageContent,
      } = options;

      const state = store.getState();
      const client = state.client;

      if (!client || !state.isReady()) {
        throw new Error("Client not ready for publishing");
      }

      const stringifiedPayload = JSON.stringify(payload);
      console.log(`Publishing with ack to topic "${topic}":`, payload);

      // Track in UI if requested
      let messageId: string | undefined;
      if (trackInUI && messageContent) {
        messageId = state.addOutgoingMessage(messageContent, "sending");
      }

      return new Promise((resolve) => {
        let timeoutId: NodeJS.Timeout;
        let resolved = false;

        const resolveOnce = (result: {
          clientMsgId: string;
          status: "sent" | "error" | "timeout";
        }) => {
          if (resolved) return;
          resolved = true;
          clearTimeout(timeoutId);
          resolve(result);
        };

        // Set up timeout
        timeoutId = setTimeout(() => {
          console.warn(
            `Publish timeout after ${timeout}ms for topic "${topic}"`,
          );
          if (messageId) {
            state.updateOutgoingMessage(messageId, { status: "timeout" });
          }
          resolveOnce({ clientMsgId: "", status: "timeout" });
        }, timeout);

        // Publish with ack
        client
          .publishWithAck({
            topic,
            messageBody: stringifiedPayload,
            onAck: (ack: AckResponse) => {
              console.log(`Received ack for topic "${topic}":`, ack);

              const status = ack.success ? "sent" : "error";
              const clientMsgId = ack.ack.clientMsgId;

              // Update UI tracking if enabled
              if (messageId) {
                state.updateOutgoingMessage(messageId, {
                  status,
                  clientMsgId,
                });
              }

              // Call user callback
              if (onAck) {
                onAck(ack);
              }

              resolveOnce({ clientMsgId: clientMsgId || "", status });
            },
          })
          .then((clientMsgId: string) => {
            // Update message with clientMsgId immediately
            if (messageId) {
              state.updateOutgoingMessage(messageId, {
                clientMsgId,
                status: "sent",
              });
            }
          })
          .catch((error: unknown) => {
            console.error(`Failed to publish to topic "${topic}":`, error);
            if (messageId) {
              state.updateOutgoingMessage(messageId, { status: "error" });
            }
            resolveOnce({ clientMsgId: "", status: "error" });
          });
      });
    },
    [store],
  );

  return {
    publish,
    publishWithAck,
  };
}
