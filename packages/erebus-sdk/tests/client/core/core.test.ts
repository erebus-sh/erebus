import { test } from "vitest";
import {
  ErebusClient,
  ErebusClientState,
} from "../../../src/client/core/Erebus";

test("Testing types and API for the pubsub client", async () => {
  const client = ErebusClient.createClient({
    client: ErebusClientState.PubSub,
    authBaseUrl: "http://localhost:6969",
    wsBaseUrl: "ws://localhost:8787",
  });

  // Test that user-friendly API works without topicSub parameter
  // This is a compilation test - if it type-checks, the API is correct

  // Must join a channel before subscribing/publishing
  client.joinChannel("test-channel");

  // These should all compile without errors:

  // Subscribe with just topic and handler
  const _test1 = client.subscribe("topic", (msg) => {
    console.log(msg);
  });

  // Publish with just topic and payload (catch since not connected)
  const _test2 = client.publish("topic", "payload").catch(() => {});

  // PublishWithAck with topic, payload, and callback (catch since not connected)
  const _test3 = client
    .publishWithAck("topic", "payload", (ack) => {
      console.log(ack);
    })
    .catch(() => {});

  // If this compiles, the types are working correctly!
}, 15000);
