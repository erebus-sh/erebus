"use client";

import { useCallback } from "react";
import { useSubscribe, type UseSubscribeOptions } from "./useSubscribe";
import { usePublish, type PublishOptions } from "./usePublish";
import { useMessages } from "./useMessages";
import { usePresence } from "./usePresence";
import { useConnection } from "./useConnection";
import type { AnySchema } from "../utils/types";
import type { AckResponse } from "@/client/core/types";
import { z } from "zod";

export interface UseTopicOptions extends UseSubscribeOptions {
  // Publishing defaults
  defaultPublishOptions?: Partial<PublishOptions>;
}

// Main hook that combines everything for the best DX
export function useTopic<
  S extends Record<string, AnySchema>,
  C extends keyof S & string,
>(topic: string, options: UseTopicOptions = {}) {
  const { defaultPublishOptions = {}, ...subscribeOptions } = options;

  // Use individual hooks
  const subscription = useSubscribe<S, C>(topic, subscribeOptions);
  const publishing = usePublish<S, C>();
  const messages = useMessages<S>(topic);
  const presence = usePresence<S>(topic);
  const connection = useConnection<S>();

  // Enhanced publish with better DX
  const publishMessage = useCallback(
    async (
      payload: z.infer<S[C]>,
      messageContent?: string,
      publishOptions?: Partial<PublishOptions>,
    ) => {
      const finalOptions = {
        ...defaultPublishOptions,
        ...publishOptions,
        trackInUI: messageContent ? true : false,
        messageContent: messageContent || JSON.stringify(payload),
      };

      return publishing.publishWithAck(topic, payload, finalOptions);
    },
    [publishing, topic, defaultPublishOptions],
  );

  // Quick publish without ack (fire and forget)
  const publishQuick = useCallback(
    (payload: z.infer<S[C]>) => {
      publishing.publish(topic, payload);
    },
    [publishing, topic],
  );

  // Enhanced publish with UI tracking and common options
  const publishWithTracking = useCallback(
    async (
      payload: z.infer<S[C]>,
      messageContent: string,
      options?: {
        onAck?: (ack: AckResponse) => void;
        timeout?: number;
      },
    ) => {
      const messageId = messages.addMessage(messageContent, "sending");

      try {
        const result = await publishing.publishWithAck(topic, payload, {
          ...options,
          trackInUI: false, // We're handling it manually for better control
          onAck: (ack) => {
            const status = ack.success ? "sent" : "error";
            messages.updateMessage(messageId, {
              status,
              clientMsgId: ack.ack.clientMsgId,
            });
            options?.onAck?.(ack);
          },
        });

        // Update with clientMsgId immediately
        messages.updateMessage(messageId, {
          clientMsgId: result.clientMsgId,
        });

        return result;
      } catch (error) {
        messages.updateMessage(messageId, { status: "error" });
        throw error;
      }
    },
    [publishing, messages, topic],
  );

  return {
    // Subscription data
    messages: subscription.messages,
    subscriptionState: subscription.subscriptionState,

    // Publishing functions
    publish: publishQuick, // Fire and forget
    publishMessage, // With ack and flexible options
    publishWithTracking, // With UI tracking included

    // Raw publishing (for advanced use)
    publishWithAck: publishing.publishWithAck,

    // Subscription management
    subscribe: subscription.subscribe,
    unsubscribe: subscription.unsubscribe,

    // Message management
    outgoingMessages: messages.outgoingMessages,
    allMessages: messages.allMessages,
    clearMessages: messages.clearMessages,

    // Presence
    presence: presence.presence,
    presenceList: presence.presenceList,
    onlineCount: presence.onlineCount,

    // Connection status
    isReady: connection.isReady,
    connectionState: connection.connectionState,
    isConnected: connection.isConnected,
  };
}
