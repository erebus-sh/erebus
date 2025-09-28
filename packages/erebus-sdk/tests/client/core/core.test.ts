import { expectTypeOf, test } from "vitest";
import {
  ErebusClient,
  ErebusClientState,
} from "../../../src/client/core/Erebus";
import { z } from "zod";
import { ErebusPubSubSchemas } from "../../../src/client/core/pubsub/PubSubFacade";
import type { MessageFor } from "../../../src/client/core/types";

test("Testing types and options for the pubsub client", async () => {
  const schemas = {
    test_topic: z.object({
      name: z.string(),
      age: z.number(),
    }),
    user_events: z.object({
      userId: z.string(),
      action: z.enum(["login", "logout", "signup"]),
      timestamp: z.number(),
    }),
  } as const;

  const client = new ErebusPubSubSchemas(
    ErebusClient.createClient({
      client: ErebusClientState.PubSub,
      authBaseUrl: "http://localhost:6969",
      wsBaseUrl: "ws://localhost:8787",
    }),
    schemas,
  );

  // Test that publish method requires correct payload type for test_topic
  expectTypeOf(client.publish<"test_topic">)
    .parameter(2)
    .toEqualTypeOf<{ name: string; age: number }>();

  // Test that publish method requires correct payload type for user_events
  expectTypeOf(client.publish<"user_events">)
    .parameter(2)
    .toEqualTypeOf<{
      userId: string;
      action: "login" | "logout" | "signup";
      timestamp: number;
    }>();

  // Test that subscribe callback receives a message whose payload is correctly typed
  expectTypeOf(client.subscribe<"test_topic">)
    .parameter(2)
    .parameter(0)
    .toEqualTypeOf<MessageFor<typeof schemas, "test_topic">>();

  // Test that publishWithAck requires correct payload type
  expectTypeOf(client.publishWithAck<"user_events">)
    .parameter(2)
    .toEqualTypeOf<{
      userId: string;
      action: "login" | "logout" | "signup";
      timestamp: number;
    }>();
}, 15000);
