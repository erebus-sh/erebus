import { beforeAll, afterAll, test, expect, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { startAuthServer } from "../../../src/server/app";
import { ErebusService } from "../../../src/service/Service";
import { Access } from "@repo/schemas/grant";
import { useErebusStore } from "../../../src/client/react/store/erebus";
import { createErebus } from "../../../src/client/react/utils/createErebus";
import { z } from "zod";
import { ErebusPubSubClient } from "../../../src/client/core/pubsub";
import { Authorize } from "../../../src/client/core/authorize";

// Simple test schema - similar to core primitive test
const erebus = createErebus(
  {
    test_channel: z.string(),
  },
  {
    wsUrl: "ws://localhost:8787",
    authUrl: "http://localhost:6970",
  },
);
const { useChannel } = erebus;

let authServer: any;

beforeAll(async () => {
  authServer = await startAuthServer(6970, async () => {
    const randomUserId = crypto.randomUUID();
    console.log("generated randomUserId", randomUserId);
    const service = new ErebusService({
      secret_api_key: "dv-er-p14umx0nlo8d5vuam32y0fn_qe8tnzyynsbp9n__mgjf_yq6",
      base_url: "http://localhost:3000",
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

afterEach(() => {
  // Clean up any remaining pubsub connections
  const pubsub = useErebusStore.getState().pubsub;
  if (pubsub) {
    pubsub.close?.();
    useErebusStore.getState().setPubsub(null);
  }
});

test("useChannel hook sends and receives messages end-to-end", async () => {
  // Generate unique topic name for this test run to avoid message replay
  const uniqueTopic = `test_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  console.log(`Starting useChannel test with unique topic: ${uniqueTopic}`);

  const { result } = renderHook(() => useChannel("test_channel"));

  // Wait for initialization
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  const pubsub = useErebusStore.getState().pubsub;
  expect(pubsub).toBeTruthy();
  console.log("Pubsub client initialized");

  // Wait until connection is open (similar to core test)
  const waitForOpen = async (maxMs = 7000) => {
    const start = Date.now();
    while (Date.now() - start < maxMs) {
      const current = useErebusStore.getState().pubsub as any;
      if (
        current &&
        current.__debugConn &&
        current.__debugConn.__debugState === "open"
      ) {
        return true;
      }
      await new Promise((r) => setTimeout(r, 50));
    }
    return false;
  };

  const isOpen = await waitForOpen();
  expect(isOpen).toBe(true);
  console.log("Connection established");

  const receivedMessages: Array<{
    id: string;
    topic: string;
    senderId: string;
    seq: string;
    sentAt: Date;
    payload: string;
  }> = [];

  // Subscribe to the unique topic
  await act(async () => {
    await result.current.subscribe(uniqueTopic, (message) => {
      receivedMessages.push(message);
    });
  });
  console.log("Subscribed to unique topic");

  // Wait for subscription readiness
  try {
    if (!pubsub) {
      throw new Error("Pubsub client not initialized");
    }
    await pubsub.waitForSubscriptionReadiness(1000);
    console.log("Subscription is ready");
  } catch (error) {
    console.warn(
      "Subscription readiness check failed, proceeding anyway:",
      error,
    );
    await new Promise((r) => setTimeout(r, 200));
  }

  // Verify initial state
  expect(receivedMessages.length).toBe(0);
  // Small delay to ensure server processes the subscription
  await new Promise((r) => setTimeout(r, 200));

  // Publish a test message from a separate publisher client (publisher should not receive own message)
  const testMessage = `Random message: ${Math.random().toString(36).substring(2, 10)}`;
  const publisher = new ErebusPubSubClient({
    wsUrl: "ws://localhost:8787/v1/pubsub",
    tokenProvider: async () => {
      const authorize = new Authorize("http://localhost:6970");
      return authorize.generateToken("test_channel");
    },
  });
  publisher.joinChannel("test_channel");
  await publisher.connect();
  // Publisher also subscribes to the topic (server requires subscription handshake)
  publisher.subscribe(uniqueTopic, () => {});
  try {
    await publisher.waitForSubscriptionReadiness?.(1000);
  } catch {}
  await publisher.publish({ topic: uniqueTopic, messageBody: testMessage });
  console.log("Message published from external publisher");

  // Wait for message processing (bounded wait like core test)
  const maxWaitMs = 10000;
  const start = Date.now();
  while (Date.now() - start < maxWaitMs && receivedMessages.length < 1) {
    await new Promise((r) => setTimeout(r, 50));
  }

  console.log(`Received ${receivedMessages.length} messages`);

  // Verify we received the message
  const receivedMessage = receivedMessages[0];
  if (!receivedMessage) {
    throw new Error("No message received");
  }

  console.log("Received message:", receivedMessage);
  expect(receivedMessage.payload).toBe(testMessage);
  expect(receivedMessage.topic).toBe(uniqueTopic);
  expect(receivedMessage.id).toBeDefined();
  expect(receivedMessage.senderId).toBeDefined();
  expect(receivedMessage.seq).toBeDefined();
  expect(receivedMessage.sentAt).toBeInstanceOf(Date);

  // Clean up
  act(() => {
    result.current.unsubscribe(uniqueTopic);
  });
  publisher.close();

  console.log("Test completed successfully");
}, 30000);
