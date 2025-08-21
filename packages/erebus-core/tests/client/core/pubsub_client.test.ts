import { beforeAll, afterAll, test, expect } from "vitest";
import { ErebusClient, ErebusClientState } from "@/client/core/Erebus";
import { startAuthServer } from "@/server/app";
import { ErebusService } from "@/service/Service";
import { Access } from "@/internal/schemas/grant";
import type { MessageBody } from "@/internal/schemas/messageBody";

// Enhanced interface for proper latency tracking
interface MessagePayloadWithLatency extends MessageBody {
  receivedAt?: number; // Client timestamp when message was received
  publishTime?: number; // Client timestamp when message was published

  // Split latency metrics:
  publishToServerLatency?: number; // sentAt - publishTime (client→server + server processing)
  serverToClientLatency?: number; // receivedAt - sentAt (server→client)
  totalRoundtripLatency?: number; // receivedAt - publishTime (total roundtrip)

  // Legacy field for backward compatibility
  processingTime?: number; // Same as totalRoundtripLatency
}

let authServer: any;

beforeAll(async () => {
  authServer = await startAuthServer(6969, async () => {
    const randomUserId = crypto.randomUUID();
    console.log("generated randomUserId", randomUserId);
    const service = new ErebusService({
      secret_api_key: "dv-er-p14umx0nlo8d5vuam32y0fn_qe8tnzyynsbp9n__mgjf_yq6",
      base_url: "http://localhost:3000", // Erebus service local server
    });
    const session = await service.prepareSession({ userId: randomUserId });
    session.join("test_channel");
    session.allow("*", Access.ReadWrite);
    return session;
  });
});

afterAll(async () => {
  if (authServer) {
    await authServer.close();
  }
});

test("Two clients flow: client2 sends 25 messages to client1, all are received", async () => {
  // Generate unique topic name for this test run to avoid message replay
  const uniqueTopic = `test_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const MESSAGE_COUNT = 25;
  console.log(
    `Starting Two clients flow test with unique topic: ${uniqueTopic}`,
  );

  const client1 = await ErebusClient.createClient({
    client: ErebusClientState.PubSub,
    authBaseUrl: "http://localhost:6969",
    wsBaseUrl: "ws://localhost:8787",
  });
  console.log("Client1 created");

  const client2 = await ErebusClient.createClient({
    client: ErebusClientState.PubSub,
    authBaseUrl: "http://localhost:6969", // Test local server [This simulate user of erebus server]
    wsBaseUrl: "ws://localhost:8787", // Cloudflare service local
  });
  console.log("Client2 created");

  // Join the test channel before connecting
  // Alternative: You could pass channel: "test_channel" in createClient options
  // and set autoConnect: true to do this automatically
  console.log("Joining test_channel for both clients...");
  client1.joinChannel("test_channel");
  client2.joinChannel("test_channel");
  console.log("Both clients joined test_channel");

  // Now connect both clients
  console.log("Connecting clients...");
  await client1.connect();
  await client2.connect();
  console.log("Both clients connected");

  const client1Messages: MessagePayloadWithLatency[] = [];
  const client2Messages: MessagePayloadWithLatency[] = [];
  const publishTimestamps: Map<string, number> = new Map(); // Track publish time by message content
  const messageQueue: string[] = []; // Track message order for proper indexing

  // Subscribe both clients to the unique topic
  client1.subscribe(uniqueTopic, (payload: MessageBody) => {
    const receivedAt = Date.now();

    // Get the publish timestamp for this specific message
    const publishTime = publishTimestamps.get(payload.payload);
    const serverSentAt = payload.sentAt.getTime(); // Server timestamp

    // Calculate split latency metrics
    const publishToServerLatency = publishTime
      ? serverSentAt - publishTime
      : undefined;
    const serverToClientLatency = receivedAt - serverSentAt;
    const totalRoundtripLatency = publishTime
      ? receivedAt - publishTime
      : undefined;

    const messageWithLatency: MessagePayloadWithLatency = {
      ...payload,
      receivedAt,
      publishTime,
      publishToServerLatency,
      serverToClientLatency,
      totalRoundtripLatency,
      processingTime: totalRoundtripLatency, // Legacy compatibility
    };

    client1Messages.push(messageWithLatency);
  });
  console.log("Client1 subscribed to unique topic");

  client2.subscribe(uniqueTopic, (payload: MessageBody) => {
    const receivedAt = Date.now();

    // Get the publish timestamp for this specific message
    const publishTime = publishTimestamps.get(payload.payload);
    const serverSentAt = payload.sentAt.getTime();

    // Calculate split latency metrics for client2 (should not receive own messages)
    const publishToServerLatency = publishTime
      ? serverSentAt - publishTime
      : undefined;
    const serverToClientLatency = receivedAt - serverSentAt;
    const totalRoundtripLatency = publishTime
      ? receivedAt - publishTime
      : undefined;

    const messageWithLatency: MessagePayloadWithLatency = {
      ...payload,
      receivedAt,
      publishTime,
      publishToServerLatency,
      serverToClientLatency,
      totalRoundtripLatency,
      processingTime: totalRoundtripLatency,
    };

    client2Messages.push(messageWithLatency);
  });
  console.log("Client2 subscribed to unique topic");

  // Wait for subscriptions to be properly acknowledged
  console.log("Waiting for subscription readiness...");
  try {
    await client1.waitForSubscriptionReadiness(1000);
    await client2.waitForSubscriptionReadiness(1000);
    console.log("All subscriptions are ready");
  } catch (error) {
    console.warn(
      "Subscription readiness check failed, proceeding anyway:",
      error,
    );
    // Fallback to fixed delay
    await new Promise((r) => setTimeout(r, 200));
  }

  // Verify initial state - no messages should be received yet
  expect(client1Messages.length).toBe(0);
  expect(client2Messages.length).toBe(0);

  const testMessages: string[] = [];

  // Send 100 random messages from client2 to client1 with proper spacing
  for (let i = 0; i < MESSAGE_COUNT; i++) {
    // Generate a random message without timestamp to avoid confusion
    const randomStr = Math.random().toString(36).substring(2, 10);
    const testMessage = `Random message ${i + 1}: ${randomStr}`;

    // Record the exact timestamp when we publish
    const publishTime = Date.now();
    publishTimestamps.set(testMessage, publishTime);
    messageQueue.push(testMessage);

    // Use async publish for better timing control
    await client2.publish({ topic: uniqueTopic, messageBody: testMessage });
    testMessages.push(testMessage);

    // Small delay between publishes to prevent WebSocket frame batching
    // and allow more accurate individual message timing
    if (i < MESSAGE_COUNT - 1) {
      // Don't wait after the last message
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  }

  // Wait for message processing (bounded wait until all messages are received)
  console.log("Waiting for message processing...");
  {
    const maxWaitMs = 30_000; // give the DO enough time under load
    const idleThresholdMs = 500; // stop when no new messages for 500ms
    let lastCount = -1;
    let lastChange = Date.now();
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      await new Promise((r) => setTimeout(r, 50));
      if (client1Messages.length !== lastCount) {
        lastCount = client1Messages.length;
        lastChange = Date.now();
      } else if (
        Date.now() - lastChange >= idleThresholdMs &&
        client1Messages.length >= MESSAGE_COUNT
      ) {
        break;
      }
    }
  }

  // Assert the expected behavior:
  // 1. Publishing client (client2) should NOT receive its own messages
  // 2. Other client (client1) should receive exactly 100 new messages, in order

  console.log(`Client1 received ${client1Messages.length} messages`);
  console.log(`Client2 received ${client2Messages.length} messages`);
  // Avoid dumping full arrays to minimize console overhead

  // Calculate and log split latency statistics
  if (client1Messages.length > 0) {
    const publishToServerLatencies = client1Messages
      .map((msg) => msg.publishToServerLatency || 0)
      .filter((t) => t > 0);
    const serverToClientLatencies = client1Messages.map(
      (msg) => msg.serverToClientLatency || 0,
    );
    const totalRoundtripLatencies = client1Messages
      .map((msg) => msg.totalRoundtripLatency || 0)
      .filter((t) => t > 0);

    console.log(`\n=== LATENCY ANALYSIS FOR CLIENT1 ===`);

    if (publishToServerLatencies.length > 0) {
      const avgPubToServer =
        publishToServerLatencies.reduce((sum, time) => sum + time, 0) /
        publishToServerLatencies.length;
      console.log(`Publish→Server (client→server + server processing):`);
      console.log(`  Average: ${avgPubToServer.toFixed(2)}ms`);
      console.log(`  Min: ${Math.min(...publishToServerLatencies)}ms`);
      console.log(`  Max: ${Math.max(...publishToServerLatencies)}ms`);
    }

    if (serverToClientLatencies.length > 0) {
      const avgServerToClient =
        serverToClientLatencies.reduce((sum, time) => sum + time, 0) /
        serverToClientLatencies.length;
      console.log(`Server→Client (server→client network):`);
      console.log(`  Average: ${avgServerToClient.toFixed(2)}ms`);
      console.log(`  Min: ${Math.min(...serverToClientLatencies)}ms`);
      console.log(`  Max: ${Math.max(...serverToClientLatencies)}ms`);
    }

    if (totalRoundtripLatencies.length > 0) {
      const avgTotal =
        totalRoundtripLatencies.reduce((sum, time) => sum + time, 0) /
        totalRoundtripLatencies.length;
      console.log(`Total Roundtrip (end-to-end):`);
      console.log(`  Average: ${avgTotal.toFixed(2)}ms`);
      console.log(`  Min: ${Math.min(...totalRoundtripLatencies)}ms`);
      console.log(`  Max: ${Math.max(...totalRoundtripLatencies)}ms`);
    }

    console.log(`\nDetailed per-message breakdown:`);
    client1Messages.forEach((msg, i) => {
      console.log(
        `  Message ${i + 1}: Pub→Server=${msg.publishToServerLatency}ms, Server→Client=${msg.serverToClientLatency}ms, Total=${msg.totalRoundtripLatency}ms`,
      );
    });

    // Server-side instrumentation summary if present
    const ingressToBroadcast = client1Messages
      .map((m) =>
        typeof m.t_ingress === "number" &&
        typeof m.t_broadcast_begin === "number"
          ? m.t_broadcast_begin - m.t_ingress
          : undefined,
      )
      .filter((n): n is number => typeof n === "number");
    const broadcastToWriteEnd = client1Messages
      .map((m) =>
        typeof m.t_broadcast_begin === "number" &&
        typeof m.t_ws_write_end === "number"
          ? m.t_ws_write_end - m.t_broadcast_begin
          : undefined,
      )
      .filter((n): n is number => typeof n === "number");
    const ingressToWriteEnd = client1Messages
      .map((m) =>
        typeof m.t_ingress === "number" && typeof m.t_ws_write_end === "number"
          ? m.t_ws_write_end - m.t_ingress
          : undefined,
      )
      .filter((n): n is number => typeof n === "number");

    const stats = (arr: number[]) => {
      if (arr.length === 0) return null;
      const sorted = [...arr].sort((a, b) => a - b);
      const avg = sorted.reduce((s, n) => s + n, 0) / sorted.length;
      const p = (q: number) => sorted[Math.floor((sorted.length - 1) * q)];
      return { avg, p50: p(0.5), p95: p(0.95), p99: p(0.99) };
    };

    const s1 = stats(ingressToBroadcast);
    const s2 = stats(broadcastToWriteEnd);
    const s3 = stats(ingressToWriteEnd);
    if (s1 || s2 || s3) {
      console.log(`\n=== SERVER INSTRUMENTATION (if provided) ===`);
      if (s1)
        console.log(
          `ingress→broadcast_begin: avg=${s1.avg.toFixed(2)}ms p50=${s1.p50}ms p95=${s1.p95}ms p99=${s1.p99}ms`,
        );
      if (s2)
        console.log(
          `broadcast_begin→ws_write_end: avg=${s2.avg.toFixed(2)}ms p50=${s2.p50}ms p95=${s2.p95}ms p99=${s2.p99}ms`,
        );
      if (s3)
        console.log(
          `ingress→ws_write_end: avg=${s3.avg.toFixed(2)}ms p50=${s3.p50}ms p95=${s3.p95}ms p99=${s3.p99}ms`,
        );
    }
  }

  // Verify client1 received exactly 1000 messages
  expect(client1Messages.length).toBe(MESSAGE_COUNT);

  // Verify client2 did NOT receive any messages (should not receive own messages)
  expect(client2Messages.length).toBe(0);

  // Verify the message content and order
  for (let i = 0; i < MESSAGE_COUNT; i++) {
    const receivedMessage = client1Messages[i];
    expect(receivedMessage).toBeDefined();
    if (receivedMessage) {
      expect(receivedMessage.topic).toBe(uniqueTopic);
      expect(receivedMessage.payload).toBe(testMessages[i]);
      expect(receivedMessage.id).toBeDefined();
      expect(receivedMessage.senderId).toBeDefined();
      expect(receivedMessage.seq).toBeDefined();
      expect(receivedMessage.sentAt).toBeDefined();
      expect(receivedMessage.totalRoundtripLatency).toBeDefined();
      expect(receivedMessage.totalRoundtripLatency).toBeGreaterThanOrEqual(0);
      expect(receivedMessage.serverToClientLatency).toBeDefined();
      expect(receivedMessage.serverToClientLatency).toBeGreaterThanOrEqual(0);

      // Verify that latencies are reasonable (should be positive and not too large)
      expect(receivedMessage.totalRoundtripLatency).toBeLessThan(5000); // Should be less than 5 seconds
      expect(receivedMessage.serverToClientLatency).toBeLessThan(3000); // Allow headroom for network variance

      // Publish→Server latency might be negative in rare cases due to clock skew, so just check it exists
      expect(receivedMessage.publishToServerLatency).toBeDefined();
    }
  }

  // Clean up
  console.log("Unsubscribing and closing clients...");
  client1.unsubscribe(uniqueTopic);
  client2.unsubscribe(uniqueTopic);

  // Small delay to ensure unsubscribe cleanup completes
  await new Promise((r) => setTimeout(r, 100));

  // Log debug information after unsubscribe to show correct state
  console.log("Client1 debug info after unsubscribe:", client1.__debugSummary);
  console.log("Client2 debug info after unsubscribe:", client2.__debugSummary);

  client1.close();
  client2.close();
  console.log("Test completed successfully");
}, 65000);
