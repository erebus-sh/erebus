"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { z } from "zod";
import {
  ErebusClient,
  ErebusClientState,
  ErebusPubSubSchemas,
  type ErebusPubSubClient,
} from "@erebus-sh/sdk/client";

// ---- Schema definition ----
// Define a Zod schema map. Each key becomes a topic "schema key" and the value
// is used for both compile-time inference and runtime validation.

const schemas = {
  chat: z.object({
    text: z.string(),
    user: z.string(),
    sentAt: z.number(),
  }),
};

// Infer the TypeScript type from the schema so we can use it in state
type ChatPayload = z.infer<(typeof schemas)["chat"]>;

interface TypedMessage {
  id: string;
  payload: ChatPayload;
}

export default function TypedPage() {
  const [typed, setTyped] = useState<ErebusPubSubSchemas<
    typeof schemas
  > | null>(null);
  const [messages, setMessages] = useState<TypedMessage[]>([]);
  const [input, setInput] = useState("");
  const [username] = useState(
    () => `user-${Math.random().toString(36).slice(2, 7)}`,
  );
  const [status, setStatus] = useState<"connecting" | "connected" | "error">(
    "connecting",
  );
  const [error, setError] = useState<string | null>(null);
  const clientRef = useRef<ErebusPubSubClient | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    // 1. Create the low-level PubSub client
    const rawClient = ErebusClient.createClient({
      client: ErebusClientState.PubSub,
      authBaseUrl: "",
      wsBaseUrl: process.env.NEXT_PUBLIC_WS_URL || "wss://gateway.erebus.sh",
    });
    clientRef.current = rawClient;

    // 2. Wrap it in ErebusPubSubSchemas for type-safe publish/subscribe.
    //    The schemas object maps topic keys to Zod schemas.
    const typedClient = new ErebusPubSubSchemas(rawClient, schemas);

    // 3. Join channel and connect (same as untyped client)
    typedClient.joinChannel("demo");

    typedClient
      .connect()
      .then(async () => {
        setStatus("connected");

        // 4. Subscribe with the typed facade.
        //    - First arg is the schema key ("chat")
        //    - Second arg is the sub-topic (used to namespace within the schema)
        //    - The callback receives a fully typed MessageFor<schemas, "chat">
        //      where message.payload is { text: string; user: string; sentAt: number }
        //    Runtime validation happens automatically -- if a message doesn't
        //    match the Zod schema it throws and the SDK drops the message.
        await typedClient.subscribe("chat", "room1", (message) => {
          setMessages((prev) => [
            ...prev,
            {
              id: message.id ?? crypto.randomUUID(),
              payload: message.payload,
            },
          ]);
        });

        setTyped(typedClient);
      })
      .catch((err) => {
        setStatus("error");
        setError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      typedClient.close();
    };
  }, []);

  // 5. Publish a typed message. The payload is validated against the Zod schema
  //    at compile time (TypeScript) and at runtime (Zod .parse()) before sending.
  const sendMessage = async () => {
    if (!typed || !input.trim()) return;

    const payload: ChatPayload = {
      text: input.trim(),
      user: username,
      sentAt: Date.now(),
    };

    try {
      await typed.publish("chat", "room1", payload);
      setInput("");
    } catch (err) {
      console.error("Failed to publish:", err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  return (
    <main className="flex flex-col h-screen max-w-2xl mx-auto">
      <header className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 px-4 py-3">
        <div>
          <Link
            href="/"
            className="text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
          >
            &larr; Back
          </Link>
          <h1 className="text-lg font-semibold">Type-Safe Chat</h1>
          <p className="text-xs text-neutral-500">
            Using <span className="font-mono">ErebusPubSubSchemas</span> with
            Zod validation
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              status === "connected"
                ? "bg-green-500"
                : status === "connecting"
                  ? "bg-yellow-500 animate-pulse"
                  : "bg-red-500"
            }`}
          />
          {status}
        </div>
      </header>

      {/* Schema info panel */}
      <div className="px-4 py-3 bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
        <p className="text-xs font-semibold text-neutral-500 mb-1">
          Active Schema
        </p>
        <pre className="text-xs font-mono text-neutral-600 dark:text-neutral-400 leading-relaxed">
          {`chat: z.object({
  text: z.string(),
  user: z.string(),
  sentAt: z.number(),
})`}
        </pre>
        <p className="text-xs text-neutral-400 mt-1">
          Messages are validated at runtime. Invalid payloads are rejected
          automatically.
        </p>
      </div>

      {error && (
        <div className="px-4 py-2 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && status === "connected" && (
          <p className="text-center text-sm text-neutral-400 mt-8">
            No messages yet. Send one to see type-safe messaging in action.
          </p>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className="flex flex-col gap-0.5">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-medium">{msg.payload.user}</span>
              <span className="text-xs text-neutral-400">
                {new Date(msg.payload.sentAt).toLocaleTimeString()}
              </span>
            </div>
            <p className="text-sm">{msg.payload.text}</p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-neutral-200 dark:border-neutral-800 px-4 py-3 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message (validated by Zod)..."
          disabled={status !== "connected"}
          className="flex-1 rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400 disabled:opacity-50"
        />
        <button
          onClick={() => void sendMessage()}
          disabled={status !== "connected" || !input.trim()}
          className="rounded-md bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Send
        </button>
      </div>
    </main>
  );
}
