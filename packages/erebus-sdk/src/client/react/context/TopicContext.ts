import type { ErebusPubSubClient } from "@/client/core/pubsub";
import { ErebusError } from "@/internal/error";
import { createContext, useContext } from "react";
import type { z } from "zod";

type TopicCtx<T extends z.ZodTypeAny> = {
  topic: string;
  client: ErebusPubSubClient;
  schema: T;
};

export const TopicContext = createContext<TopicCtx<any> | null>(null);

export function useTopic() {
  const ctx = useContext(TopicContext);
  if (!ctx) throw new ErebusError("useTopic must be used within TopicProvider");
  return ctx;
}
