"use client";

import { useErebus } from "../context/ErebusContext";
import { ErebusError } from "@/internal/error";
import { TopicContext } from "../context/TopicContext";
import React from "react";
import { createNoopPubSubClient } from "../utils/noopClient";

type Props<K extends string> = {
  children: React.ReactNode;
  topic: K;
};

export function TopicProvider<K extends string>({ children, topic }: Props<K>) {
  const isServer = typeof window === "undefined";
  const { makeClient } = isServer
    ? { makeClient: () => createNoopPubSubClient() }
    : useErebus();
  const client = isServer ? createNoopPubSubClient() : makeClient();

  if (!client) {
    throw new ErebusError("TopicProvider must be used within a ErebusProvider");
  }

  return (
    <TopicContext.Provider value={{ topic, client }}>
      {children}
    </TopicContext.Provider>
  );
}
