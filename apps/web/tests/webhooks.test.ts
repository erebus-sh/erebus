import { test, expect } from "vitest";
import { createRpcClient } from "@/server/rpc";

test("webhooks apis should be working", async () => {
  const rpc = await createRpcClient("http://localhost:3000/");
  const webhook = await rpc.api.v1.webhooks.usage.$post({
    json: {
      event: "websocket.message",
      data: {
        projectId: "k57e9xfj97da0wqr372t9pxza57mztq6",
        payloadLength: 100,
      },
    },
  });
  expect(webhook.ok).toBe(true);
});
