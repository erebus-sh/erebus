import { useErebus } from "../context/ErebusContext";
import type { SchemaMap } from "../utils/types";
import { ErebusError } from "@/internal/error";
import { ErebusPubSubClient } from "@/client/core/pubsub";
import { TopicContext } from "../context/TopicContext";
type Props<S extends SchemaMap> = {
  children: React.ReactNode;
  topic: string;
  client: ErebusPubSubClient;
  schema: S;
};
export function TopicProvider<S extends SchemaMap>({
  children,
  topic,
  schema,
}: Props<S>) {
  const { makeClient } = useErebus();
  const client = makeClient();

  if (!client) {
    throw new ErebusError(
      "ChannelProvider must be used within a ErebusProvider",
    );
  }

  return (
    <TopicContext.Provider value={{ topic, client, schema }}>
      {children}
    </TopicContext.Provider>
  );
}
