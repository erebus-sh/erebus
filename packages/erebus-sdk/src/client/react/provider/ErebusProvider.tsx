"use client";

import type { ErebusPubSubClient } from "@/client/core/pubsub";
import { ErebusContext } from "../context/ErebusContext";
import type { ReactNode } from "react";
import { ErebusClient, ErebusClientState } from "@/client/core/Erebus";
import { getGrant, setGrant } from "../cache/grantCache";
import { createNoopPubSubClient } from "../utils/noopClient";

interface ErebusProviderProps {
  children: ReactNode;
  authBaseUrl: string;
  wsBaseUrl?: string;
  enableCaching?: boolean; // Optional, defaults to true
}

export function ErebusProvider({
  children,
  authBaseUrl,
  wsBaseUrl,
  enableCaching = true, // Default to true
}: ErebusProviderProps) {
  // Factory: each call gives you a new client bound to a channel
  const makeClient = (): ErebusPubSubClient => {
    if (typeof window === "undefined") {
      return createNoopPubSubClient();
    }
    return ErebusClient.createClientSync({
      client: ErebusClientState.PubSub,
      authBaseUrl,
      wsBaseUrl,
      enableCaching,
      grantCacheLayer(): Promise<string | undefined> {
        return Promise.resolve(getGrant());
      },
      cacheGrant(grant: string) {
        setGrant(grant);
      },
    });
  };
  return (
    <ErebusContext.Provider value={{ makeClient }}>
      {children}
    </ErebusContext.Provider>
  );
}
