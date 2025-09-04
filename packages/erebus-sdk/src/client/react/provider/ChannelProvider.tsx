import { useEffect } from "react";
import { ChannelContext } from "../context/ChannelContext";
import { useErebus } from "../context/ErebusContext";
import { useChannelStore } from "../store/state";
import { ErebusError } from "@/internal/error";
import { ZodAny } from "zod";

type Props = { children: React.ReactNode; channel: string; schema: ZodAny };

export function ChannelProvider({ children, channel, schema }: Props) {
  const { makeClient } = useErebus();
  const client = makeClient();
  if (!client) {
    throw new ErebusError(
      "ChannelProvider must be used within a ErebusProvider",
    );
  }
  const { setConnected, setReady, setTopics, setError } = useChannelStore();

  useEffect(() => {
    (async () => {
      setConnected(false);
      setReady(false);
      setTopics([]);
      client.joinChannel(channel);
      try {
        await client.connect();
        setConnected(true);
        setReady(true);
      } catch (error) {
        setConnected(false);
        setReady(false);
        setError(error as Error);
      }
    })();

    return () => {
      client.close();
    };
  }, [client, channel]);

  return (
    <ChannelContext.Provider value={{ channel, client, schema }}>
      {children}
    </ChannelContext.Provider>
  );
}
