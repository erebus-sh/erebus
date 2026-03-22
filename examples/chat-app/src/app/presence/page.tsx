"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ErebusClient,
  ErebusClientState,
  type ErebusPubSubClient,
  type Presence,
} from "@erebus-sh/sdk/client";

interface ChatMessage {
  id: string;
  user: string;
  text: string;
  sentAt: number;
}

interface PresenceEntry {
  clientId: string;
  status: "online" | "offline";
  timestamp: number;
}

export default function PresencePage() {
  const [client, setClient] = useState<ErebusPubSubClient | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [peers, setPeers] = useState<Map<string, PresenceEntry>>(new Map());
  const [input, setInput] = useState("");
  const [username] = useState(
    () => `user-${Math.random().toString(36).slice(2, 7)}`,
  );
  const [status, setStatus] = useState<"connecting" | "connected" | "error">(
    "connecting",
  );
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const c = ErebusClient.createClient({
      client: ErebusClientState.PubSub,
      authBaseUrl: "",
      wsBaseUrl: process.env.NEXT_PUBLIC_WS_URL || "wss://gateway.erebus.sh",
    });

    c.joinChannel("demo");

    c.connect()
      .then(async () => {
        setStatus("connected");

        // Subscribe to chat messages on the "chat" topic
        await c.subscribe("chat", (message) => {
          try {
            const parsed = JSON.parse(message.payload) as ChatMessage;
            setMessages((prev) => [
              ...prev,
              {
                id: message.id ?? crypto.randomUUID(),
                user: parsed.user,
                text: parsed.text,
                sentAt: parsed.sentAt,
              },
            ]);
          } catch {
            // Ignore malformed messages
          }
        });

        // Register a presence handler for the "chat" topic.
        // The handler fires whenever a peer joins or leaves.
        // Presence is a { clientId, topic, status, timestamp } object.
        await c.onPresence("chat", (presence: Presence) => {
          setPeers((prev) => {
            const next = new Map(prev);
            next.set(presence.clientId, {
              clientId: presence.clientId,
              status: presence.status,
              timestamp: presence.timestamp,
            });
            return next;
          });
        });

        setClient(c);
      })
      .catch((err) => {
        setStatus("error");
        setError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      c.close();
    };
  }, []);

  const sendMessage = async () => {
    if (!client || !input.trim()) return;

    const payload: ChatMessage = {
      id: crypto.randomUUID(),
      user: username,
      text: input.trim(),
      sentAt: Date.now(),
    };

    try {
      await client.publish("chat", JSON.stringify(payload));
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

  // Derive online users from the peers map
  const onlineUsers = Array.from(peers.values()).filter(
    (p) => p.status === "online",
  );

  return (
    <main className="flex h-screen max-w-4xl mx-auto">
      {/* Sidebar: online users */}
      <aside className="w-56 shrink-0 border-r border-neutral-200 dark:border-neutral-800 flex flex-col">
        <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
          <Link
            href="/"
            className="text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
          >
            &larr; Back
          </Link>
          <h2 className="text-sm font-semibold mt-1">
            Online ({onlineUsers.length})
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
          {onlineUsers.length === 0 && (
            <p className="text-xs text-neutral-400">No peers yet</p>
          )}
          {onlineUsers.map((peer) => (
            <div key={peer.clientId} className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
              <span className="text-sm font-mono truncate">
                {peer.clientId.slice(0, 12)}
              </span>
            </div>
          ))}
        </div>

        {/* Presence event log */}
        <div className="border-t border-neutral-200 dark:border-neutral-800 px-4 py-2">
          <h3 className="text-xs font-semibold text-neutral-500 mb-1">
            Recent Events
          </h3>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {Array.from(peers.values())
              .sort((a, b) => b.timestamp - a.timestamp)
              .slice(0, 10)
              .map((peer) => (
                <div
                  key={`${peer.clientId}-${peer.timestamp}`}
                  className="text-xs text-neutral-400"
                >
                  <span className="font-mono">{peer.clientId.slice(0, 8)}</span>{" "}
                  {peer.status === "online" ? "joined" : "left"}{" "}
                  {new Date(peer.timestamp).toLocaleTimeString()}
                </div>
              ))}
          </div>
        </div>
      </aside>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        <header className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 px-4 py-3">
          <div>
            <h1 className="text-lg font-semibold">Presence + Chat</h1>
            <p className="text-xs text-neutral-500">
              Signed in as <span className="font-mono">{username}</span>
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

        {error && (
          <div className="px-4 py-2 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 text-sm">
            {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.length === 0 && status === "connected" && (
            <p className="text-center text-sm text-neutral-400 mt-8">
              No messages yet. Say something!
            </p>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className="flex flex-col gap-0.5">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium">{msg.user}</span>
                <span className="text-xs text-neutral-400">
                  {new Date(msg.sentAt).toLocaleTimeString()}
                </span>
              </div>
              <p className="text-sm">{msg.text}</p>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-neutral-200 dark:border-neutral-800 px-4 py-3 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
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
      </div>
    </main>
  );
}
