import type { ErebusPubSubClient } from "@/client/core/pubsub";
import { ErebusError } from "@/internal/error";
import { createContext, useContext } from "react";
import { ZodAny } from "zod";

interface ChannelProviderProps {
  channel: string;
  client: ErebusPubSubClient;
  schema: ZodAny;
}

type ChannelCtx = ChannelProviderProps | null;

export const ChannelContext = createContext<ChannelCtx>(null);
export function useChannel() {
  const ctx = useContext(ChannelContext);
  if (!ctx)
    throw new ErebusError("useChannel must be used within ChannelProvider");
  return ctx;
}
