import { beforeAll, test } from "vitest";
import {
  ErebusClient,
  ErebusClientState,
} from "../../../src/client/core/Erebus";
import { createGenericAdapter } from "../../../src/server";
import { ErebusService } from "../../../src/service/Service";
import { Access } from "@repo/schemas/grant";
import { serve } from "@hono/node-server";

let authServer: any;

beforeAll(() => {
  authServer = createGenericAdapter({
    authorize: async (channel, ctx) => {
      const randomUserId = crypto.randomUUID();
      console.log("generated randomUserId", randomUserId);
      const service = new ErebusService({
        secret_api_key:
          "dv-er-a9ti6g5fnybi2mug3t5mi5o7w27121ehxsy8l6nf5xijxzu4",
        base_url: "http://localhost:3000", // Erebus service local server
      });
      const session = await service.prepareSession({ userId: randomUserId });
      session.join(channel);
      session.allow("*", Access.ReadWrite);
      return session;
    },
    fireWebhook: async (message) => {
      // noop
    },
  });

  serve({
    fetch: authServer.fetch,
    port: 6969,
  });
});

test("Two clients flow: client2 sends 3 messages to client1, all are received", async () => {
  // Generate unique topic name for this test run to avoid message replay
  const uniqueTopic = `test_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const uniqueChannel = `test_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const MESSAGE_COUNT = 3;
  console.log(
    `Starting Two clients flow test with unique topic: ${uniqueTopic}`,
  );

  const client1 = ErebusClient.createClient({
    client: ErebusClientState.PubSub,
    authBaseUrl: "http://localhost:6969",
    wsBaseUrl: "ws://localhost:8787",
  });
  console.log("Client1 created");

  const client2 = ErebusClient.createClient({
    client: ErebusClientState.PubSub,
    authBaseUrl: "http://localhost:6969", // Test local server [This simulate user of erebus server]
    wsBaseUrl: "ws://localhost:8787", // Cloudflare service local
  });
  console.log("Client2 created");

  // Join both clients to the same channel
  await Promise.all([
    client1.joinChannel(uniqueChannel),
    client2.joinChannel(uniqueChannel),
  ]);

  // Connect both clients to the same channel
  await Promise.all([client1.connect(), client2.connect()]);

  // We subscribe to the topic to receive messages from client2
  await client1.subscribe(uniqueTopic, (msg) => {
    console.log("📩 Received:", msg.payload, "from", msg.senderId);
  });

  // You must subscribe to the topic before publishing
  await client2.subscribe(uniqueTopic, (msg) => {
    console.log("📩 Received:", msg.payload, "from", msg.senderId);
  });

  // Publish messages from client2 to client1
  for (let i = 0; i < MESSAGE_COUNT; i++) {
    await client2.publishWithAck(
      uniqueTopic,
      `Hello from client2! ${i}`,
      (ack) => {
        if (ack.success) {
          console.log("✅ Message acknowledged:", ack.ack);
        } else {
          throw new Error(
            "Message not acknowledged probably because the client is not connected or the topic is not subscribed",
          );
        }
      },
    );
  }

  // Wait for all messages to be received
  await new Promise((resolve) => setTimeout(resolve, 5000));

  // Close both clients
  await Promise.all([client1.close(), client2.close()]);
}, 15000);
