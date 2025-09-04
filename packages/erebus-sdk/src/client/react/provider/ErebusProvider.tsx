import type { ErebusClient } from "@/client/core/Erebus";
import { ErebusContext } from "../context/ErebusContext";

type ErebusProviderProps = {
  children: React.ReactNode;
  client: ErebusClient;
};

export const ErebusProvider = ({ children, client }: ErebusProviderProps) => {
  return (
    <ErebusContext.Provider value={{ client }}>
      {children}
    </ErebusContext.Provider>
  );
};
