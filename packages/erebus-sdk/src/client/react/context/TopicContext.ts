"use client";
import type { ErebusPubSubClient } from "@/client/core/pubsub";
import { ErebusError } from "@/internal/error";
import React from "react";

type TopicCtx = {
  topic: string;
  client: ErebusPubSubClient;
};

type TopicContextType = TopicCtx | null;

// SSR-safe context creation
const TopicContext =
  typeof window !== "undefined"
    ? React.createContext<TopicContextType>(null)
    : ({
        Provider: ({ children }: { children: React.ReactNode }) => children,
        Consumer: () => null,
        displayName: "TopicContext",
      } as unknown as React.Context<TopicContextType>);

export { TopicContext };

export function useTopic() {
  // SSR-safe: return a stub that throws at runtime usage, not during prerender
  if (typeof window === "undefined") {
    return {
      topic: "",
      client: new Proxy({} as ErebusPubSubClient, {
        get() {
          throw new ErebusError(
            "Topic/client are not available during server-side rendering. Call useTopic only in client components at runtime.",
          );
        },
      }),
    };
  }

  const ctx = React.useContext(TopicContext);
  if (!ctx) throw new ErebusError("useTopic must be used within TopicProvider");
  return ctx;
}
