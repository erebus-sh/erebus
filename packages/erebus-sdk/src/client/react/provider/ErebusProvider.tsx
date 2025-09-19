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

    // Clean up wsBaseUrl and authBaseUrl if they end with a trailing slash
    let cleanedWsBaseUrl = wsBaseUrl;
    if (typeof wsBaseUrl === "string") {
      cleanedWsBaseUrl = wsBaseUrl.replace(/\/+$/, "");
      // Check for path after the port/host (but allow protocol://)
      const wsUrlParts = cleanedWsBaseUrl.match(/^(wss?):\/\/([^\/]+)(\/.*)?$/);
      if (wsUrlParts && wsUrlParts[3]) {
        throw new Error(
          "wsBaseUrl must be a base URL without a trailing slash or path. Use e.g. ws://localhost:8787, not ws://localhost:8787/ or ws://localhost:8787/somepath",
        );
      }
    }

    let cleanedAuthBaseUrl = authBaseUrl;
    if (typeof authBaseUrl === "string") {
      cleanedAuthBaseUrl = authBaseUrl.replace(/\/+$/, "");
      // Check for path after the port/host (but allow protocol://)
      const httpUrlParts = cleanedAuthBaseUrl.match(
        /^(https?):\/\/([^\/]+)(\/.*)?$/,
      );
      if (httpUrlParts && httpUrlParts[3]) {
        throw new Error(
          "authBaseUrl must be a base URL without a trailing slash or path. Use e.g. http://localhost:3002, not http://localhost:3002/ or http://localhost:3002/somepath",
        );
      }
    }

    return ErebusClient.createClient({
      client: ErebusClientState.PubSub,
      authBaseUrl: cleanedAuthBaseUrl,
      wsBaseUrl: cleanedWsBaseUrl,
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
