import { PacketEnvelope } from "@repo/schemas/packetEnvelope";
import { SELF, env } from "cloudflare:test";
import { describe, it, expect } from "vitest";

const token =
  "eyJhbGciOiJFZERTQSJ9.eyJwcm9qZWN0X2lkIjoiazU3ZTl4Zmo5N2RhMHdxcjM3MnQ5cHh6YTU3bXp0cTYiLCJjaGFubmVsIjoidGVzdCIsInRvcGljcyI6W3sidG9waWMiOiJ0ZXN0Iiwic2NvcGUiOiJyZWFkLXdyaXRlIn1dLCJ1c2VySWQiOiJ0ZXN0MSIsImlzc3VlZEF0IjoxNzU1NDIxNTUwLCJleHBpcmVzQXQiOjE3NTU0Mjg3NDksImlhdCI6MTc1NTQyMTU1MCwiZXhwIjoxNzU1NDI4NzUwfQ.MECO4ZuGNqf0kplTYYz2RJDjCl4e93chQcJApHxsHB0G-gyXqdC0keoSrwytMM4QeDLKYtKRIbSoCQDthJ-6Dw";

const token1 =
  "eyJhbGciOiJFZERTQSJ9.eyJwcm9qZWN0X2lkIjoiazU3ZTl4Zmo5N2RhMHdxcjM3MnQ5cHh6YTU3bXp0cTYiLCJjaGFubmVsIjoidGVzdCIsInRvcGljcyI6W3sidG9waWMiOiJ0ZXN0Iiwic2NvcGUiOiJyZWFkLXdyaXRlIn1dLCJ1c2VySWQiOiJ0ZXN0IiwiaXNzdWVkQXQiOjE3NTU0MjE1ODIsImV4cGlyZXNBdCI6MTc1NTQyODc4MSwiaWF0IjoxNzU1NDIxNTgyLCJleHAiOjE3NTU0Mjg3ODJ9.UomHgyD14NsdfXhX38VeJ98MJnzoeoB66iaaK-LhdeK3vICifbVmcRmPpSB7JFt7O-BA0rpQa3rBmfzZyz9wDg";
const once = <T extends Event>(emitter: EventTarget, type: string) =>
  new Promise<T>((resolve) =>
    emitter.addEventListener(type, (e) => resolve(e as T), { once: true }),
  );

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Helper Functions and Types
interface WebSocketConnection {
  ws: WebSocket;
  response: Response;
}

interface MessagePayload {
  message?: string;
  messageNumber?: number;
  sentAt?: string;
  testId?: string;
  clientMsgId?: string;
  clientPublishTs?: number;
  [key: string]: unknown;
}

interface ReceivedMessage {
  payload: {
    payload: string | MessagePayload; // Can be string or object
  };
  topic: string;
  senderId: string;
  seq: string;
  sentAt: string;
  // New timing fields
  t_ingress?: number;
  t_enqueued?: number;
  t_broadcast_begin?: number;
  t_ws_write_end?: number;
  t_broadcast_end?: number;
  // Client correlation fields
  clientMsgId?: string;
  clientPublishTs?: number;
  publishTime?: number; // Computed field
  publishToServerLatency?: number; // Computed field
  serverToClientLatency?: number; // Computed field
  totalRoundtripLatency?: number; // Computed field
}

interface MessageListener {
  messages: ReceivedMessage[];
  timestamps: number[];
  cleanup: () => void;
}

/**
 * Creates a WebSocket connection to the pubsub endpoint
 */
async function createWebSocketConnection(
  locationHint = "test-location",
  grantToken = token,
): Promise<WebSocketConnection> {
  const url = new URL("http://localhost:8787/v1/pubsub");

  const req = new Request(url, {
    headers: {
      Upgrade: "websocket",
      "x-location-hint": locationHint,
      "X-Erebus-Grant": grantToken,
    },
  });

  const res = await SELF.fetch(req);
  expect(res.status).toBe(101);

  const ws = res.webSocket;
  expect(ws).toBeDefined();

  ws!.accept();

  return { ws: ws!, response: res };
}

/**
 * Sends a connect packet to authenticate the WebSocket connection
 */
async function connectToChannel(
  ws: WebSocket,
  grantToken = token,
): Promise<void> {
  const connectPacket = {
    packetType: "connect",
    grantJWT: grantToken,
  };

  ws.send(JSON.stringify(connectPacket));
  await sleep(200); // Wait for connection to be established

  expect(ws.readyState).toBe(1); // Verify connection is open
}

/**
 * Subscribes to a topic on the WebSocket connection
 */
async function subscribeToTopic(ws: WebSocket, topic: string): Promise<void> {
  const subscribePacket: PacketEnvelope = {
    packetType: "subscribe",
    topic: topic,
  };

  ws.send(JSON.stringify(subscribePacket));
  await sleep(200); // Wait for subscription to be processed
}

/**
 * Publishes a message to a topic with client correlation support
 */
async function publishMessage(
  ws: WebSocket,
  topic: string,
  messageContent: {
    message: string;
    messageNumber: number;
    sentAt: string;
    testId: string;
    clientMsgId?: string;
    clientPublishTs?: number;
  },
  messageId: string,
  senderId: string = "test-sender",
): Promise<void> {
  const clientMsgId = messageContent.clientMsgId || crypto.randomUUID();

  const messagePacket: PacketEnvelope = {
    packetType: "publish",
    topic: topic,
    clientMsgId: clientMsgId,
    payload: {
      id: messageId,
      topic: topic,
      senderId: senderId,
      seq: messageId,
      sentAt: new Date(),
      payload: JSON.stringify(messageContent),
      clientMsgId: clientMsgId,
      clientPublishTs: messageContent.clientPublishTs,
    },
  };

  ws.send(JSON.stringify(messagePacket));
}

/**
 * Sets up a message listener that captures incoming messages and their timestamps
 */
function setupMessageListener(
  ws: WebSocket,
  publishTimestamps?: Map<string, number>,
): MessageListener {
  const messages: ReceivedMessage[] = [];
  const timestamps: number[] = [];

  const messageHandler = (event: MessageEvent) => {
    const receivedAt = Date.now();
    timestamps.push(receivedAt);

    try {
      const payload = JSON.parse(event.data as string);

      // Extract client correlation info from the payload
      const { clientMsgId, clientPublishTs } =
        typeof payload.payload === "object"
          ? payload.payload
          : { clientMsgId: undefined, clientPublishTs: undefined };

      // Calculate publish time from correlation map or client timestamp
      const publishTime =
        clientMsgId && publishTimestamps
          ? publishTimestamps.get(clientMsgId)
          : (clientPublishTs ?? undefined);

      const serverSentAtWall = new Date(payload.sentAt).getTime();

      // Calculate latencies
      const publishToServerLatency = publishTime
        ? (payload.t_ingress ?? serverSentAtWall) - publishTime
        : undefined;
      const serverToClientLatency = receivedAt - serverSentAtWall;
      const totalRoundtripLatency = publishTime
        ? receivedAt - publishTime
        : undefined;

      const enrichedMessage = {
        ...payload,
        publishTime,
        publishToServerLatency,
        serverToClientLatency,
        totalRoundtripLatency,
      };

      messages.push(enrichedMessage);
    } catch (e) {
      // Fallback for unparseable messages
      messages.push(event.data);
    }
  };

  ws.addEventListener("message", messageHandler);

  const cleanup = () => {
    ws.removeEventListener("message", messageHandler);
  };

  return { messages, timestamps, cleanup };
}

/**
 * Closes WebSocket connection gracefully
 */
async function closeConnection(
  ws: WebSocket,
  reason = "test complete",
): Promise<void> {
  ws.close(1000, reason);
  await sleep(100); // Give time for cleanup
}
describe("WebSocket /v1/pubsub general tests", () => {
  it("upgrades to WebSocket (101) and handles connect packet", async () => {
    const connection = await createWebSocketConnection();
    await connectToChannel(connection.ws);
    await closeConnection(connection.ws);
  });

  it("properly closes WebSocket connection", async () => {
    const connection = await createWebSocketConnection();
    await connectToChannel(connection.ws);

    // Verify WebSocket is still open before closing
    expect(connection.ws.readyState).toBe(1); // OPEN state

    // Close the connection
    connection.ws.close(1000, "test close");

    // Verify WebSocket is closed (readyState 3 = CLOSED)
    expect([2, 3]).toContain(connection.ws.readyState); // CLOSING or CLOSED state
  });

  it("subscribes to a channel and sends a message", async () => {
    const connection = await createWebSocketConnection();
    await connectToChannel(connection.ws);
    await subscribeToTopic(connection.ws, "test");

    // Send a message to the channel with client correlation
    const clientMsgId = crypto.randomUUID();
    const clientPublishTs = Date.now();
    await publishMessage(
      connection.ws,
      "test",
      {
        message: "test message",
        messageNumber: 1,
        sentAt: new Date().toISOString(),
        testId: "test",
        clientMsgId,
        clientPublishTs,
      },
      "1",
      "me",
    );

    await sleep(2500);
    await closeConnection(connection.ws);
  });
});

describe("WebSocket /v1/pubsub channel two clients tests", () => {
  // Set long timeout for this test
  const testTimeout = 30000; // 30 seconds

  it(
    "two clients subscribe to the same channel and test message fanout with timestamp calculation",
    async () => {
      // Create two WebSocket connections (using same location hint to ensure they're on the same shard)
      const sharedLocationHint = "test-location-shared";
      const publisherConnection = await createWebSocketConnection(
        sharedLocationHint,
        token,
      );
      const subscriberConnection = await createWebSocketConnection(
        sharedLocationHint,
        token1,
      );

      // Connect both clients
      await connectToChannel(publisherConnection.ws, token);
      await connectToChannel(subscriberConnection.ws, token1);

      // Subscribe both clients to the same topic
      const testTopic = "test";
      await subscribeToTopic(publisherConnection.ws, testTopic);
      await subscribeToTopic(subscriberConnection.ws, testTopic);

      // Map from clientMsgId -> publishTime for correlation
      const publishTimestamps = new Map<string, number>();
      const testMessages: { clientMsgId: string; text: string }[] = [];

      // Set up message listener on the subscriber client with correlation support
      const messageListener = setupMessageListener(
        subscriberConnection.ws,
        publishTimestamps,
      );

      const messageCount = 5;

      // Send 5 messages from the publisher with correlation IDs
      for (let i = 1; i <= messageCount; i++) {
        const text = `Test message ${i}`;
        const clientMsgId = crypto.randomUUID();
        const publishTime = Date.now();
        publishTimestamps.set(clientMsgId, publishTime);

        const messageContent = {
          message: text,
          messageNumber: i,
          sentAt: new Date(publishTime).toISOString(),
          testId: "fanout-test",
          clientMsgId,
          clientPublishTs: publishTime,
        };

        await publishMessage(
          publisherConnection.ws,
          testTopic,
          messageContent,
          `msg-${i}`,
          `publisher-client`,
        );
        testMessages.push({ clientMsgId, text });

        // Small delay between messages to make timestamps distinguishable
        await sleep(50);
      }

      // Wait for all messages to be received
      await sleep(2000);

      // Verify that the subscriber received all 5 messages
      expect(messageListener.messages.length).toBe(messageCount);
      expect(messageListener.timestamps.length).toBe(messageCount);

      // Verify all messages have t_ws_write_end populated
      for (const msg of messageListener.messages) {
        expect(msg.t_ws_write_end).toBeDefined();
        expect(typeof msg.t_ws_write_end).toBe("number");
        expect(msg.t_ws_write_end).toBeGreaterThan(0);
      }

      // Log timing information for debugging and verify latencies
      for (let i = 0; i < messageCount; i++) {
        const msg = messageListener.messages[i];

        const clientMsgId =
          msg.payload &&
          typeof msg.payload === "object" &&
          "clientMsgId" in msg.payload
            ? msg.payload.clientMsgId
            : "no-id";
        console.log(`Message ${i + 1} (${clientMsgId}):`);
        console.log(`  t_ingress: ${msg.t_ingress?.toFixed(3)}ms`);
        console.log(`  t_enqueued: ${msg.t_enqueued?.toFixed(3)}ms`);
        console.log(
          `  t_broadcast_begin: ${msg.t_broadcast_begin?.toFixed(3)}ms`,
        );
        console.log(`  t_ws_write_end: ${msg.t_ws_write_end?.toFixed(3)}ms`);
        console.log(`  t_broadcast_end: ${msg.t_broadcast_end?.toFixed(3)}ms`);
        console.log(
          `  publishToServerLatency: ${msg.publishToServerLatency?.toFixed(2)}ms`,
        );
        console.log(
          `  serverToClientLatency: ${msg.serverToClientLatency?.toFixed(2)}ms`,
        );
        console.log(
          `  totalRoundtripLatency: ${msg.totalRoundtripLatency?.toFixed(2)}ms`,
        );

        // Verify latencies are reasonable
        if (msg.publishToServerLatency !== undefined) {
          expect(msg.publishToServerLatency).toBeGreaterThanOrEqual(0);
        }
        expect(msg.serverToClientLatency).toBeGreaterThanOrEqual(0);
        if (msg.totalRoundtripLatency !== undefined) {
          expect(msg.totalRoundtripLatency).toBeGreaterThanOrEqual(0);
          expect(msg.totalRoundtripLatency).toBeLessThan(5000); // 5 second max
        }

        // Verify timing consistency (monotonic property)
        if (msg.t_ingress && msg.t_enqueued) {
          expect(msg.t_enqueued).toBeGreaterThanOrEqual(msg.t_ingress);
        }
        if (msg.t_enqueued && msg.t_broadcast_begin) {
          expect(msg.t_broadcast_begin).toBeGreaterThanOrEqual(msg.t_enqueued);
        }
        if (msg.t_broadcast_begin && msg.t_ws_write_end) {
          expect(msg.t_ws_write_end).toBeGreaterThanOrEqual(
            msg.t_broadcast_begin,
          );
        }
      }

      // Calculate p50/p95/p99 statistics for different timing segments
      const ingressToBroadcastLatencies = messageListener.messages
        .filter((msg) => msg.t_ingress && msg.t_broadcast_begin)
        .map((msg) => msg.t_broadcast_begin! - msg.t_ingress!);

      const broadcastToWriteEndLatencies = messageListener.messages
        .filter((msg) => msg.t_broadcast_begin && msg.t_ws_write_end)
        .map((msg) => msg.t_ws_write_end! - msg.t_broadcast_begin!);

      const totalRoundtripLatencies = messageListener.messages
        .filter((msg) => msg.totalRoundtripLatency !== undefined)
        .map((msg) => msg.totalRoundtripLatency!);

      // Calculate percentiles
      const calculatePercentiles = (values: number[]) => {
        if (values.length === 0) return { p50: 0, p95: 0, p99: 0 };
        const sorted = values.slice().sort((a, b) => a - b);
        return {
          p50: sorted[Math.floor(sorted.length * 0.5)],
          p95: sorted[Math.floor(sorted.length * 0.95)],
          p99: sorted[Math.floor(sorted.length * 0.99)],
        };
      };

      const ingressToBroadcastStats = calculatePercentiles(
        ingressToBroadcastLatencies,
      );
      const broadcastToWriteEndStats = calculatePercentiles(
        broadcastToWriteEndLatencies,
      );
      const totalRoundtripStats = calculatePercentiles(totalRoundtripLatencies);

      console.log(`\nLatency Statistics:`);
      console.log(
        `  Ingress → Broadcast Begin: p50=${ingressToBroadcastStats.p50.toFixed(2)}ms, p95=${ingressToBroadcastStats.p95.toFixed(2)}ms, p99=${ingressToBroadcastStats.p99.toFixed(2)}ms`,
      );
      console.log(
        `  Broadcast Begin → WS Write End: p50=${broadcastToWriteEndStats.p50.toFixed(2)}ms, p95=${broadcastToWriteEndStats.p95.toFixed(2)}ms, p99=${broadcastToWriteEndStats.p99.toFixed(2)}ms`,
      );
      console.log(
        `  Total Roundtrip: p50=${totalRoundtripStats.p50.toFixed(2)}ms, p95=${totalRoundtripStats.p95.toFixed(2)}ms, p99=${totalRoundtripStats.p99.toFixed(2)}ms`,
      );

      // Verify message order is preserved using clientMsgId correlation
      for (let i = 0; i < messageCount; i++) {
        const expectedClientMsgId = testMessages[i].clientMsgId;

        // Find the message by clientMsgId (order might have changed but correlation should work)
        const matchingMessage = messageListener.messages.find((msg) => {
          const payload = msg.payload;
          return (
            payload &&
            typeof payload === "object" &&
            "clientMsgId" in payload &&
            payload.clientMsgId === expectedClientMsgId
          );
        });
        expect(matchingMessage).toBeDefined();

        if (
          matchingMessage &&
          matchingMessage.payload &&
          typeof matchingMessage.payload === "object" &&
          "messageNumber" in matchingMessage.payload
        ) {
          expect(matchingMessage.payload.messageNumber).toBe(i + 1);
        }
      }

      // Clean up
      messageListener.cleanup();
      await closeConnection(publisherConnection.ws, "publisher test complete");
      await closeConnection(
        subscriberConnection.ws,
        "subscriber test complete",
      );
    },
    testTimeout,
  ); // Set the timeout for this specific test
});
