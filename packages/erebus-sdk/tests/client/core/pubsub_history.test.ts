import { describe, test, expect } from "vitest";
import {
  ErebusClient,
  ErebusClientState,
} from "../../../src/client/core/Erebus";
import { z } from "zod";
import { ErebusPubSubSchemas } from "../../../src/client/core/pubsub/PubSubFacade";
import type { MessageFor } from "../../../src/client/core/types";

describe("PubSub History API", () => {
  const MessageSchema = z.object({
    text: z.string(),
    timestamp: z.number(),
  });

  const schemas = {
    chat: MessageSchema,
  };

  test("getHistory returns properly typed messages", async () => {
    const client = ErebusClient.createClient({
      client: ErebusClientState.PubSub,
      authBaseUrl: "https://api.erebus.sh",
      wsBaseUrl: "wss://gateway.erebus.sh",
    });

    const typed = new ErebusPubSubSchemas(client, schemas);

    await typed.joinChannel("test-channel");
    await typed.connect();

    // Fetch history
    const history = await typed.getHistory("chat", "room-1", {
      limit: 10,
      direction: "backward",
    });

    // Type assertions
    expect(history).toHaveProperty("items");
    expect(history).toHaveProperty("nextCursor");
    expect(Array.isArray(history.items)).toBe(true);

    // Check typed payload
    if (history.items.length > 0) {
      const firstMsg = history.items[0];
      expect(firstMsg.payload).toHaveProperty("text");
      expect(firstMsg.payload).toHaveProperty("timestamp");
      expect(typeof firstMsg.payload.text).toBe("string");
      expect(typeof firstMsg.payload.timestamp).toBe("number");
    }
  });

  test("getHistory with cursor pagination", async () => {
    const client = ErebusClient.createClient({
      client: ErebusClientState.PubSub,
      authBaseUrl: "https://api.erebus.sh",
    });

    const typed = new ErebusPubSubSchemas(client, schemas);
    await typed.joinChannel("test-channel");
    await typed.connect();

    const firstPage = await typed.getHistory("chat", "room-1", { limit: 5 });

    if (firstPage.nextCursor) {
      const secondPage = await typed.getHistory("chat", "room-1", {
        cursor: firstPage.nextCursor,
        limit: 5,
      });

      expect(secondPage.items).toBeDefined();
      // Pages should not overlap
      if (firstPage.items.length > 0 && secondPage.items.length > 0) {
        expect(firstPage.items[0].seq).not.toBe(secondPage.items[0].seq);
      }
    }
  });

  test("getHistory forward direction", async () => {
    const client = ErebusClient.createClient({
      client: ErebusClientState.PubSub,
      authBaseUrl: "https://api.erebus.sh",
    });

    const typed = new ErebusPubSubSchemas(client, schemas);
    await typed.joinChannel("test-channel");
    await typed.connect();

    const history = await typed.getHistory("chat", "room-1", {
      direction: "forward",
      limit: 10,
    });

    expect(history.items).toBeDefined();

    // If we have multiple messages, verify forward ordering
    if (history.items.length > 1) {
      for (let i = 1; i < history.items.length; i++) {
        // ULID sequences should be increasing (lexicographically)
        expect(history.items[i].seq > history.items[i - 1].seq).toBe(true);
      }
    }
  });

  test("createHistoryIterator fetches batches sequentially", async () => {
    const client = ErebusClient.createClient({
      client: ErebusClientState.PubSub,
      authBaseUrl: "https://api.erebus.sh",
    });

    const typed = new ErebusPubSubSchemas(client, schemas);
    await typed.joinChannel("test-channel");
    await typed.connect();

    const getNext = typed.createHistoryIterator("chat", "room-1", {
      limit: 5,
      direction: "backward",
    });

    // First batch
    const firstBatch = await getNext();
    expect(firstBatch).toBeDefined();
    if (firstBatch) {
      expect(firstBatch).toHaveProperty("items");
      expect(firstBatch).toHaveProperty("hasMore");
      expect(Array.isArray(firstBatch.items)).toBe(true);

      // If there are more messages, fetch next batch
      if (firstBatch.hasMore) {
        const secondBatch = await getNext();
        expect(secondBatch).toBeDefined();
        if (secondBatch) {
          expect(Array.isArray(secondBatch.items)).toBe(true);

          // Ensure no overlap between batches
          if (firstBatch.items.length > 0 && secondBatch.items.length > 0) {
            expect(firstBatch.items[0].seq).not.toBe(secondBatch.items[0].seq);
          }
        }
      } else {
        // If no more, next call should return null
        const exhausted = await getNext();
        expect(exhausted).toBeNull();
      }
    }
  });

  test("createHistoryIterator returns null when exhausted", async () => {
    const client = ErebusClient.createClient({
      client: ErebusClientState.PubSub,
      authBaseUrl: "https://api.erebus.sh",
    });

    const typed = new ErebusPubSubSchemas(client, schemas);
    await typed.joinChannel("test-channel");
    await typed.connect();

    const getNext = typed.createHistoryIterator("chat", "room-1", {
      limit: 1000, // Large limit to exhaust in one call
    });

    const firstBatch = await getNext();
    expect(firstBatch).toBeDefined();

    if (firstBatch && !firstBatch.hasMore) {
      // Should return null on next call
      const exhausted = await getNext();
      expect(exhausted).toBeNull();

      // And continue returning null
      const stillExhausted = await getNext();
      expect(stillExhausted).toBeNull();
    }
  });

  test("typed messages maintain proper structure", async () => {
    const client = ErebusClient.createClient({
      client: ErebusClientState.PubSub,
      authBaseUrl: "https://api.erebus.sh",
    });

    const typed = new ErebusPubSubSchemas(client, schemas);
    await typed.joinChannel("test-channel");
    await typed.connect();

    const history = await typed.getHistory("chat", "room-1", { limit: 1 });

    if (history.items.length > 0) {
      const msg = history.items[0];

      // MessageBody fields
      expect(msg).toHaveProperty("id");
      expect(msg).toHaveProperty("topic");
      expect(msg).toHaveProperty("senderId");
      expect(msg).toHaveProperty("seq");
      expect(msg).toHaveProperty("sentAt");
      expect(msg).toHaveProperty("payload");

      // Typed payload
      expect(typeof msg.payload.text).toBe("string");
      expect(typeof msg.payload.timestamp).toBe("number");
    }
  });
});
