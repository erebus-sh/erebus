import { useEffect, useRef } from "react";
import { useErebus } from "../context/ErebusContext";
import { useChannel } from "../context/ChannelContext";
import { ZodAny } from "zod";

interface UseTopicProps {
  topic: string;
}

export function useTopic({ topic }: UseTopicProps) {
  const { client, schema } = useChannel();
  // TODO: How the fuck to type this?, you figuer this out feature me
  const message = useRef<ZodAny>(null);

  useEffect(() => {
    client.subscribe(topic, (message) => {
      console.log(message);
    });
  }, [topic]);
}
