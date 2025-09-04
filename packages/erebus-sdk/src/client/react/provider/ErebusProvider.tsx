import type { ErebusPubSubClient } from "@/client/core/pubsub";
import { ErebusContext } from "../context/ErebusContext";
import type { ReactNode } from "react";
import { ErebusClient, ErebusClientState } from "@/client/core/Erebus";

interface ErebusProviderProps {
  children: ReactNode;
  authBaseUrl: string;
  wsBaseUrl?: string;
}

export function ErebusProvider({
  children,
  authBaseUrl,
  wsBaseUrl,
}: ErebusProviderProps) {
  // Factory: each call gives you a new client bound to a channel
  const makeClient = (): ErebusPubSubClient => {
    return ErebusClient.createClientSync({
      client: ErebusClientState.PubSub,
      authBaseUrl,
      wsBaseUrl,
    });
  };
  return (
    <ErebusContext.Provider value={{ makeClient }}>
      {children}
    </ErebusContext.Provider>
  );
}
