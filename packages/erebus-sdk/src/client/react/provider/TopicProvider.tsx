"use client";

import { useErebus } from "../context/ErebusContext";
import { ErebusError } from "@/internal/error";
import { TopicContext } from "../context/TopicContext";
import React from "react";
import { createNoopPubSubClient } from "../utils/noopClient";
import type { ErebusPubSubClient } from "@/client/core/pubsub";

type Props<K extends string> = {
  children: React.ReactNode;
  topic: K;
};

// Global cache to prevent duplicate client creation for the same topic
const clientCache = new Map<string, ErebusPubSubClient>();

export function TopicProvider<K extends string>({ children, topic }: Props<K>) {
  const isServer = typeof window === "undefined";
  const { makeClient } = isServer
    ? { makeClient: () => createNoopPubSubClient() }
    : useErebus();

  // Use cached client if available, otherwise create new one
  const client = React.useMemo(() => {
    if (isServer) {
      return createNoopPubSubClient();
    }

    if (!clientCache.has(topic)) {
      const newClient = makeClient();
      if (!newClient) {
        throw new ErebusError(
          "TopicProvider must be used within a ErebusProvider",
        );
      }
      clientCache.set(topic, newClient);
    }

    return clientCache.get(topic)!;
  }, [topic, makeClient, isServer]);

  if (!client) {
    throw new ErebusError("TopicProvider must be used within a ErebusProvider");
  }

  return (
    <TopicContext.Provider value={{ topic, client }}>
      {children}
    </TopicContext.Provider>
  );
}
