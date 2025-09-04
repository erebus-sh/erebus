import type { ErebusPubSubClient } from "@/client/core/pubsub";
import { ErebusError } from "@/internal/error";
import { createContext, useContext } from "react";

type ErebusContext = {
  makeClient: () => ErebusPubSubClient;
} | null;

export const ErebusContext = createContext<ErebusContext>(null);

export function useErebus() {
  const context = useContext(ErebusContext);
  if (!context) {
    throw new ErebusError(
      "useErebusContext must be used within a ErebusProvider",
    );
  }
  return context;
}
