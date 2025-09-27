import {
  ErebusClient,
  ErebusClientState,
  ErebusPubSubSchemas,
} from "@erebus-sh/sdk/client";
import { createGenericAdapter } from "@erebus-sh/sdk/server";
import { Access, ErebusService } from "@erebus-sh/sdk/service";
import Bun from "bun";
import { z } from "zod";

const SECRET_API_KEY =
  process.env.SECRET_API_KEY ||
  "dv-er-a9ti6g5fnybi2mug3t5mi5o7w27121ehxsy8l6nf5xijxzu4"; // replace with your own secret_api_key from the platform

const app = createGenericAdapter({
  authorize: async (channel, ctx) => {
    // Normally you'd check cookies, headers, or DB here
    const userId = Math.random().toString(36).substring(2, 15);

    const service = new ErebusService({
      secret_api_key: SECRET_API_KEY,
      base_url: "http://localhost:3000", // (optional if you self-host locally) where your Erebus service is running
    });

    // Create a session for this user
    const session = await service.prepareSession({ userId });

    // Join the requested channel
    session.join(channel);

    // Allow reads + writes
    session.allow("*", Access.ReadWrite);

    return session;
  },
  fireWebhook: async (message) => {
    // You can handle the webhook message here
  },
});

try {
  Bun.serve({
    port: 4919,
    fetch: app.fetch,
  });
} catch (e) {
  console.log("Auth server already running");
}

console.log("✅ Auth server running at http://localhost:3000");

async function main() {
  // 1. Define your schema
  const schemas = {
    news: z.object({
      title: z.string(),
      body: z.string(),
      timestamp: z.number(),
    }),
  } as const;
  const clientUnTyped = ErebusClient.createClient({
    client: ErebusClientState.PubSub,
    authBaseUrl: "http://localhost:4919", // your auth domain
    wsBaseUrl: "ws://localhost:8787", // your ws domain (optional if you self-host locally)
  });
  const client = new ErebusPubSubSchemas(clientUnTyped, schemas);

  // Join a channel first
  client.joinChannel("test_channel123");

  // Connect
  await client.connect();
  console.log("✅ Connected successfully!");

  // Subscribe to a channel
  await client.subscribe("news", "sports", (msg) => {
    console.log(
      "📩 Received:",
      "Title:",
      msg.payload.title,
      "from",
      msg.senderId,
      "timestamp",
      msg.payload.timestamp,
    );
  });
  console.log("✅ Subscribed successfully!");

  // Register presence handler
  await client.onPresence("news", "sports", (presence) => {
    console.log(
      "📩 Presence: Status:",
      presence.status,
      "Topic:",
      presence.topic,
    );
  });
  console.log("✅ Presence handler registered!");

  // Publish a message
  await client.publish("news", "sports", {
    title: "John",
    body: "Hello",
    timestamp: 30,
  });
}
main().catch(console.error);
