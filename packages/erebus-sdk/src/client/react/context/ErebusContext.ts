"use client";

import type { ErebusPubSubClient } from "@/client/core/pubsub";
import { ErebusError } from "@/internal/error";
import React from "react";

type ErebusContextType = {
  makeClient: () => ErebusPubSubClient;
} | null;

// SSR-safe context creation
const ErebusContext =
  typeof window !== "undefined"
    ? React.createContext<ErebusContextType>(null)
    : ({
        Provider: ({ children }: { children: React.ReactNode }) => children,
        Consumer: () => null,
        displayName: "ErebusContext",
      } as unknown as React.Context<ErebusContextType>);

export { ErebusContext };

export function useErebus() {
  // SSR-safe: return a stub that throws at runtime usage, not during prerender
  if (typeof window === "undefined") {
    return {
      makeClient: () => {
        throw new ErebusError(
          "Erebus client is not available during server-side rendering. Call useErebus only in client components at runtime.",
        );
      },
    };
  }

  const context = React.useContext(ErebusContext);
  if (!context) {
    throw new ErebusError("useErebus must be used within a ErebusProvider");
  }
  return context;
}
