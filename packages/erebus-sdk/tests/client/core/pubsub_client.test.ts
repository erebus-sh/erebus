import { beforeAll, test, expect } from "vitest";
import {
  ErebusClient,
  ErebusClientState,
} from "../../../src/client/core/Erebus";
import { createGenericAdapter } from "../../../src/server";
import { ErebusService } from "../../../src/service/Service";
import { Access } from "@repo/schemas/grant";
import type { MessageBody } from "@repo/schemas/messageBody";
import type {
  AckResponse,
  AckSuccess,
  AckError,
} from "../../../src/client/core/types";
import { serve } from "@hono/node-server";

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

beforeAll(() => {
  authServer = createGenericAdapter({
    authorize: async (channel, ctx) => {
      const randomUserId = crypto.randomUUID();
      console.log("generated randomUserId", randomUserId);
      const service = new ErebusService({
        secret_api_key:
          "dv-er-4o7j90qw39p96bra19fa94prupp6vdcg9axrd3hg4hqy68c1",
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

test("ACK functionality: client publishes with ACK and receives proper acknowledgment", async () => {
  // Generate unique topic name for this test run
  const uniqueTopic = `ack_test_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const testMessage = `ACK test message: ${Math.random().toString(36).substring(2, 10)}`;

  console.log(`Starting ACK functionality test with topic: ${uniqueTopic}`);

  const client = await ErebusClient.createClient({
    client: ErebusClientState.PubSub,
    authBaseUrl: "http://localhost:6969",
    wsBaseUrl: "ws://localhost:8787",
  });
  console.log("Client created for ACK test");

  // Join the test channel and connect
  client.joinChannel("test_channel");
  await client.connect();
  console.log("Client connected for ACK test");

  // Subscribe to the topic
  const receivedMessages: MessagePayloadWithLatency[] = [];
  client.subscribe(uniqueTopic, (payload: MessageBody) => {
    const receivedAt = Date.now();
    const messageWithLatency: MessagePayloadWithLatency = {
      ...payload,
      receivedAt,
      processingTime: receivedAt - payload.sentAt.getTime(),
    };
    receivedMessages.push(messageWithLatency);
    console.log(
      `Received message: ${payload.payload} with seq: ${payload.seq}`,
    );
  });
  console.log("Client subscribed to topic for ACK test");

  // Wait for subscription readiness
  try {
    await client.waitForSubscriptionReadiness(1000);
    console.log("Subscription is ready for ACK test");
  } catch (error) {
    console.warn(
      "Subscription readiness check failed, proceeding anyway:",
      error,
    );
    await new Promise((r) => setTimeout(r, 200));
  }

  // Test ACK functionality
  let ackReceived = false;
  let ackSuccess = false;
  let ackData: AckResponse | null = null;
  let ackError: { code: string; message: string } | undefined = undefined;

  const publishStartTime = Date.now();

  // Publish with ACK
  await client.publishWithAck({
    topic: uniqueTopic,
    messageBody: testMessage,
    onAck: (ackResponse) => {
      const ackEndTime = Date.now();
      const ackLatency = ackEndTime - publishStartTime;

      if (ackResponse.success) {
        console.log(`Success ACK received after ${ackLatency}ms:`, {
          success: ackResponse.success,
          topic: ackResponse.topic,
          seq: ackResponse.seq,
          serverMsgId: ackResponse.serverMsgId,
        });
      } else {
        console.log(`Error ACK received after ${ackLatency}ms:`, {
          success: ackResponse.success,
          topic: ackResponse.topic,
          error: ackResponse.error,
        });
      }

      ackReceived = true;
      ackSuccess = ackResponse.success;
      ackData = ackResponse;

      if (!ackResponse.success && ackResponse.error) {
        ackError = ackResponse.error;
      }
    },
    timeoutMs: 10000, // 10 second timeout
  });

  // Wait for ACK to be received
  console.log("Waiting for ACK response...");
  const maxWaitMs = 15000; // 15 second max wait
  const startWait = Date.now();

  while (!ackReceived && Date.now() - startWait < maxWaitMs) {
    await new Promise((r) => setTimeout(r, 100));
  }

  // Verify ACK was received
  expect(ackReceived).toBe(true);
  expect(ackSuccess).toBe(true);
  expect(ackData).toBeDefined();

  if (ackData) {
    if ((ackData as AckResponse).success) {
      const successAck = ackData as AckSuccess;
      expect(successAck.ack).toBeDefined();
      expect(successAck.topic).toBe(uniqueTopic);
      expect(successAck.seq).toBeDefined();
      expect(successAck.serverMsgId).toBeDefined();
    } else {
      throw new Error("Expected success ACK but received error ACK");
    }
  }

  expect(ackError).toBeUndefined();

  // Verify ACK packet structure matches expected format
  if (ackData && (ackData as AckResponse).success) {
    const successAck = ackData as AckSuccess;
    expect(successAck.ack.packetType).toBe("ack");
    expect(successAck.ack.result.path).toBe("publish");
    expect(successAck.ack.result.topic).toBe(uniqueTopic);
    expect(successAck.ack.result.result.ok).toBe(true);

    // Verify result properties exist and are correct type
    const result = successAck.ack.result.result as {
      ok: true;
      t_ingress: number;
    };
    if (result.ok) {
      expect(result.t_ingress).toBeDefined();
      expect(typeof result.t_ingress).toBe("number");
      expect(result.ok).toBeDefined();
      expect(typeof result.ok).toBe("boolean");
    }
  }

  // Note: In pub/sub systems, publishers typically don't receive their own messages
  // This is the expected behavior, so we don't wait for the message to be received by the publisher
  console.log(
    "Note: Publishers don't receive their own messages in pub/sub systems",
  );

  // The test passes if we got the ACK successfully, which we already verified above
  // If we wanted to test message delivery, we would need a separate subscriber client

  console.log("ACK test completed successfully - ACK received correctly");

  // Clean up
  client.unsubscribe(uniqueTopic);
  await new Promise((r) => setTimeout(r, 100));
  client.close();
}, 30000);

test("ACK error handling: client publishes to unauthorized topic and receives error ACK", async () => {
  // Generate unique topic name for this test run
  const unauthorizedTopic = `unauthorized_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const testMessage = `Unauthorized test message: ${Math.random().toString(36).substring(2, 10)}`;

  console.log(
    `Starting ACK error handling test with unauthorized topic: ${unauthorizedTopic}`,
  );

  const client = await ErebusClient.createClient({
    client: ErebusClientState.PubSub,
    authBaseUrl: "http://localhost:6969",
    wsBaseUrl: "ws://localhost:8787",
  });
  console.log("Client created for ACK error test");

  // Join the test channel and connect
  client.joinChannel("test_channel");
  await client.connect();
  console.log("Client connected for ACK error test");

  // Note: We don't subscribe to the unauthorized topic, so publish should fail

  // Test ACK error functionality
  let ackReceived = false;
  let ackSuccess = false;
  let ackData: AckResponse | null = null;
  let ackError: { code: string; message: string } | undefined = undefined;

  const publishStartTime = Date.now();

  // Publish with ACK to unauthorized topic (should fail)
  await client.publishWithAck({
    topic: unauthorizedTopic,
    messageBody: testMessage,
    onAck: (ackResponse) => {
      const ackEndTime = Date.now();
      const ackLatency = ackEndTime - publishStartTime;

      if (ackResponse.success) {
        console.log(`Unexpected success ACK received after ${ackLatency}ms:`, {
          success: ackResponse.success,
          topic: ackResponse.topic,
        });
      } else {
        console.log(`Error ACK received after ${ackLatency}ms:`, {
          success: ackResponse.success,
          topic: ackResponse.topic,
          error: ackResponse.error,
        });
      }

      ackReceived = true;
      ackSuccess = ackResponse.success;
      ackData = ackResponse;

      if (!ackResponse.success && ackResponse.error) {
        ackError = ackResponse.error;
      }
    },
    timeoutMs: 10000, // 10 second timeout
  });

  // Wait for ACK to be received
  console.log("Waiting for error ACK response...");
  const maxWaitMs = 15000; // 15 second max wait
  const startWait = Date.now();

  while (!ackReceived && Date.now() - startWait < maxWaitMs) {
    await new Promise((r) => setTimeout(r, 100));
  }

  // Verify ACK was received
  expect(ackReceived).toBe(true);
  expect(ackSuccess).toBe(false); // Should be false for error
  expect(ackData).toBeDefined();
  expect(ackError).toBeDefined();

  // Use direct property check for error ACK
  if (ackData && !(ackData as AckResponse).success) {
    const errorAck = ackData as AckError;
    expect(errorAck.ack).toBeDefined();
    expect(errorAck.topic).toBe(unauthorizedTopic);

    // Verify error ACK packet structure matches expected format
    expect(errorAck.ack.packetType).toBe("ack");
    expect(errorAck.ack.result.path).toBe("publish");
    expect(errorAck.ack.result.topic).toBe(unauthorizedTopic);
    expect(errorAck.ack.result.result.ok).toBe(false);

    // Verify error result properties using type assertion
    const result = errorAck.ack.result.result as {
      ok: false;
      code: string;
      message: string;
    };
    expect(result.code).toBeDefined();
    expect(typeof result.code).toBe("string");
    expect(result.message).toBeDefined();
    expect(typeof result.message).toBe("string");
  } else if (ackData) {
    throw new Error("Expected error ACK but received success ACK");
  }

  // Verify error details
  if (ackError) {
    const error = ackError as { code: string; message: string };
    expect(error.code).toBeDefined();
    expect(error.message).toBeDefined();
    expect(typeof error.code).toBe("string");
    expect(typeof error.message).toBe("string");
  }

  console.log("ACK error handling test completed successfully");
  if (ackError && ackData && !(ackData as AckResponse).success) {
    const errorAck = ackData as AckError;
    const error = ackError as { code: string; message: string };
    console.log("Error ACK details:", {
      topic: errorAck.topic,
      errorCode: error.code,
      errorMessage: error.message,
    });
  }

  // Clean up
  client.close();
}, 30000);

test("Presence functionality: clients receive presence updates when others subscribe/unsubscribe", async () => {
  // Generate unique topic name for this test run
  const uniqueTopic = `presence_test_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  console.log(
    `Starting presence functionality test with topic: ${uniqueTopic}`,
  );

  // Create two clients for presence testing
  const client1 = await ErebusClient.createClient({
    client: ErebusClientState.PubSub,
    authBaseUrl: "http://localhost:6969",
    wsBaseUrl: "ws://localhost:8787",
  });

  const client2 = await ErebusClient.createClient({
    client: ErebusClientState.PubSub,
    authBaseUrl: "http://localhost:6969",
    wsBaseUrl: "ws://localhost:8787",
  });

  console.log("Both clients created for presence test");

  // Join the test channel for both clients
  client1.joinChannel("test_channel");
  client2.joinChannel("test_channel");

  // Connect both clients
  await client1.connect();
  await client2.connect();
  console.log("Both clients connected for presence test");

  // Track presence events
  const client1PresenceEvents: Array<{
    clientId: string;
    topic: string;
    status: "online" | "offline";
    timestamp: number;
  }> = [];
  const client2PresenceEvents: Array<{
    clientId: string;
    topic: string;
    status: "online" | "offline";
    timestamp: number;
  }> = [];

  // Set up presence handlers
  client1.onPresence(uniqueTopic, (presence) => {
    console.log(`Client1 received presence update:`, {
      clientId: presence.clientId,
      topic: presence.topic,
      status: presence.status,
      timestamp: presence.timestamp,
    });
    client1PresenceEvents.push(presence);
  });

  client2.onPresence(uniqueTopic, (presence) => {
    console.log(`Client2 received presence update:`, {
      clientId: presence.clientId,
      topic: presence.topic,
      status: presence.status,
      timestamp: presence.timestamp,
    });
    client2PresenceEvents.push(presence);
  });

  console.log("Presence handlers set up for both clients");

  // Client1 subscribes to the topic (should trigger presence updates)
  client1.subscribe(uniqueTopic, (payload: MessageBody) => {
    console.log(`Client1 received message: ${payload.payload}`);
  });

  // Wait a bit for the subscription and presence update to process
  await new Promise((r) => setTimeout(r, 500));

  // Client2 subscribes to the topic (should trigger another presence update)
  client2.subscribe(uniqueTopic, (payload: MessageBody) => {
    console.log(`Client2 received message: ${payload.payload}`);
  });

  // Wait for presence updates to be processed
  await new Promise((r) => setTimeout(r, 1000));

  console.log(`Client1 presence events: ${client1PresenceEvents.length}`);
  console.log(`Client2 presence events: ${client2PresenceEvents.length}`);

  // Both clients should have received presence updates about each other's subscriptions
  expect(client1PresenceEvents.length).toBeGreaterThanOrEqual(1);
  expect(client2PresenceEvents.length).toBeGreaterThanOrEqual(1);

  // Verify presence event structure
  if (client1PresenceEvents.length > 0) {
    const presenceEvent = client1PresenceEvents[0];
    expect(presenceEvent.clientId).toBeDefined();
    expect(typeof presenceEvent.clientId).toBe("string");
    expect(presenceEvent.topic).toBe(uniqueTopic);
    expect(presenceEvent.status).toBeDefined();
    expect(["online", "offline"]).toContain(presenceEvent.status);
    expect(typeof presenceEvent.timestamp).toBe("number");
    expect(presenceEvent.timestamp).toBeGreaterThan(0);
  }

  // Test unsubscribe presence updates
  const initialPresenceCount = client1PresenceEvents.length;

  // Client2 unsubscribes (should trigger presence update)
  client2.unsubscribe(uniqueTopic);

  // Wait for unsubscribe presence update
  await new Promise((r) => setTimeout(r, 500));

  // Client1 should have received a presence update about client2's unsubscription
  expect(client1PresenceEvents.length).toBeGreaterThanOrEqual(
    initialPresenceCount,
  );

  // Verify we received both online and offline events
  const onlineEvents = client1PresenceEvents.filter(
    (e) => e.status === "online",
  );
  const offlineEvents = client1PresenceEvents.filter(
    (e) => e.status === "offline",
  );

  console.log(
    `Client1 received ${onlineEvents.length} online events and ${offlineEvents.length} offline events`,
  );

  // Should have at least one online event (client2 subscribing) and one offline event (client2 unsubscribing)
  expect(onlineEvents.length).toBeGreaterThanOrEqual(1);
  expect(offlineEvents.length).toBeGreaterThanOrEqual(1);

  console.log("Presence functionality test completed successfully");

  // Clean up
  client1.unsubscribe(uniqueTopic);
  await new Promise((r) => setTimeout(r, 100));

  client1.close();
  client2.close();
}, 30000);
