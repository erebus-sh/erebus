"use client";
import type { ErebusPubSubClient } from "@/client/core/pubsub";
import { ErebusError } from "@/internal/error";
import React from "react";
import { createNoopPubSubClient } from "../utils/noopClient";

type TopicCtx = {
  topic: string;
  client: ErebusPubSubClient;
};

type TopicContextType = TopicCtx | null;

// Always create a real React context - handle SSR in the hook
const TopicContext = React.createContext<TopicContextType>(null);
TopicContext.displayName = "TopicContext";

export { TopicContext };

export function useTopic() {
  // SSR-safe: return a stub that throws at runtime usage, not during prerender
  if (typeof window === "undefined") {
    return { topic: "", client: createNoopPubSubClient() } as const;
  }

  const ctx = React.useContext(TopicContext);
  if (!ctx) throw new ErebusError("useTopic must be used within TopicProvider");
  return ctx;
}
