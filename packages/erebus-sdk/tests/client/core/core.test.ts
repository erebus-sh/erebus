import { expectTypeOf, test } from "vitest";
import {
  ErebusClient,
  ErebusClientState,
} from "../../../src/client/core/Erebus";
import { SubscribeOptions } from "../../../src/client/core/pubsub/types";
import type { SubscriptionCallback } from "../../../src/client/core/types";

test("Testing types and options for the pubsub client", async () => {
  const client = ErebusClient.createClient({
    client: ErebusClientState.PubSub,
    authBaseUrl: "http://localhost:6969",
    wsBaseUrl: "ws://localhost:8787",
  });

  expectTypeOf(client.subscribe)
    .parameter(4)
    .toEqualTypeOf<SubscribeOptions | undefined>();

  // Overload parameter unions
  expectTypeOf(client.subscribe)
    .parameter(2)
    .toEqualTypeOf<SubscriptionCallback | SubscribeOptions | undefined>();

  expectTypeOf(client.subscribe)
    .parameter(3)
    .toEqualTypeOf<number | SubscribeOptions | undefined>();
}, 15000);
