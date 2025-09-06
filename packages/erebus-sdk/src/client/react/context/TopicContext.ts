"use client";
import type { ErebusPubSubClient } from "@/client/core/pubsub";
import { ErebusError } from "@/internal/error";
import { createContext, useContext } from "react";

type TopicCtx = {
  topic: string;
  client: ErebusPubSubClient;
};

export const TopicContext = createContext<TopicCtx | null>(null);

export function useTopic() {
  const ctx = useContext(TopicContext);
  if (!ctx) throw new ErebusError("useTopic must be used within TopicProvider");
  return ctx;
}
