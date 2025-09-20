import { ErebusClient, ErebusClientState } from "@erebus-sh/sdk/client";
import { createGenericAdapter } from "@erebus-sh/sdk/server";
import { Access, ErebusService } from "@erebus-sh/sdk/service";
import Bun from "bun";

const client = ErebusClient.createClient({
  client: ErebusClientState.PubSub,
  authBaseUrl: "http://localhost:3000", // your auth domain
  wsBaseUrl: "ws://localhost:8787", // your ws domain (optional if you self-host locally)
});

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

Bun.serve({
  port: 4919,
  fetch: app.fetch,
});

console.log("✅ Auth server running at http://localhost:3000");

async function main() {
  // Join a channel first
  client.joinChannel("firstChannel");
  // Connect
  await client.connect();

  // Subscribe to a channel
  client.subscribe("room-1", (msg) => {
    console.log("📩 Received:", msg.payload, "from", msg.senderId);
  });

  // Publish a message
  await client.publishWithAck({
    topic: "hello-world",
    messageBody: "Hello Erebus 👋",
    onAck: (ack) => {
      console.log("✅ Message acknowledged:", ack.ack);
    },
  });

  // Sleep for 1 second
  await new Promise((r) => setTimeout(r, 1000));
}

main().catch(console.error);
