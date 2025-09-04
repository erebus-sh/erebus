import type { ErebusClient } from "@/client/core/Erebus";
import { createContext, useContext } from "react";

type ErebusContext = {
  client: ErebusClient;
} | null;

export const ErebusContext = createContext<ErebusContext>(null);

export const useErebus = () => {
  const context = useContext(ErebusContext);
  if (!context) {
    throw new Error("useErebusContext must be used within a ErebusProvider");
  }
  return context;
};
