"use client";

import { useCallback } from "react";
import {
  useConnection,
  useSubscribe,
  usePublish,
  usePresence,
  useMessages,
  useTopic,
  type UseSubscribeOptions,
  type UseTopicOptions,
  type PublishOptions,
} from "../hooks";
import type { AnySchema } from "./types";
import { z } from "zod";

export function createTypedHooks<
  S extends Record<string, AnySchema>,
  C extends keyof S & string,
>() {
  // Fully typed connection hook
  function useTypedConnection() {
    return useConnection<S>();
  }

  // Fully typed subscribe hook
  function useTypedSubscribe(topic: string, options?: UseSubscribeOptions) {
    return useSubscribe<S, C>(topic, options);
  }

  // Fully typed publish hook
  function useTypedPublish() {
    const publishing = usePublish<S, C>();

    return {
      publish: useCallback(
        (topic: string, payload: z.infer<S[C]>) => {
          publishing.publish(topic, payload);
        },
        [publishing],
      ),

      publishWithAck: useCallback(
        (topic: string, payload: z.infer<S[C]>, options?: PublishOptions) => {
          return publishing.publishWithAck(topic, payload, options);
        },
        [publishing],
      ),
    };
  }

  // Fully typed presence hook
  function useTypedPresence(topic: string) {
    return usePresence<S>(topic);
  }

  // Fully typed messages hook
  function useTypedMessages(topic?: string) {
    return useMessages<S>(topic);
  }

  // Fully typed topic hook (the main one most users will use)
  function useTypedTopic(topic: string, options?: UseTopicOptions) {
    return useTopic<S, C>(topic, options);
  }

  return {
    useConnection: useTypedConnection,
    useSubscribe: useTypedSubscribe,
    usePublish: useTypedPublish,
    usePresence: useTypedPresence,
    useMessages: useTypedMessages,
    useTopic: useTypedTopic,
  };
}
