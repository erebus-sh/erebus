"use client";

import type { ErebusPubSubClient } from "@/client/core/pubsub";
import { ErebusError } from "@/internal/error";
import React from "react";
import { createNoopPubSubClient } from "../utils/noopClient";

type ErebusContextType = {
  makeClient: () => ErebusPubSubClient;
} | null;

// Always create a real React context - handle SSR in the hook
const ErebusContext = React.createContext<ErebusContextType>(null);
ErebusContext.displayName = "ErebusContext";

export { ErebusContext };

export function useErebus() {
  // SSR-safe: return a stub that throws at runtime usage, not during prerender
  if (typeof window === "undefined") {
    return { makeClient: () => createNoopPubSubClient() } as const;
  }

  const context = React.useContext(ErebusContext);
  if (!context) {
    throw new ErebusError("useErebus must be used within a ErebusProvider");
  }
  return context;
}
