import { expect, test } from "vitest";
import { ErebusPubSubClient } from "@/client/core/pubsub/ErebusPubSubClient";

test("Creating an Erebus client object", () => {
  process.env.NODE_ENV = "test";
  const client = new ErebusPubSubClient({
    wsUrl: "ws://localhost:8080",
    tokenProvider: async () => "test",
  });
  expect(client).toBeDefined();
  expect(client.__debugObject).toBeDefined();
  expect(client.__debugObject.connectionObject.url).toBe("ws://localhost:8080");
  expect(client.__debugConn).toBeDefined();
  expect(client.__debugSummary).toEqual(
    expect.objectContaining({ handlerCount: 0 }),
  );
});
