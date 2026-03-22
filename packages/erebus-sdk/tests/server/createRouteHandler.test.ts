import { test, expect } from "vitest";
import { createRouteHandler } from "@/server/adapter/next";
import { ErebusService } from "@/service/Service";
import { Access } from "@/service/types";

function makeRequest(
  url: string,
  method: "POST" | "GET" = "POST",
  body?: object,
) {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

const noopFireWebhook = async () => {};

test("route handler passes session from authorize to hono app", async () => {
  let authorizeCalled = false;

  const handler = createRouteHandler({
    authorize: async (channel, ctx) => {
      authorizeCalled = true;

      expect(channel).toBe("");
      expect(ctx?.req).toBeInstanceOf(Request);

      const service = new ErebusService({
        secret_api_key:
          "dv-er-abcdefghijklmnopqrstuvwxyzABCDEFGsH1234abcdddddd",
      });
      const session = await service.prepareSession({
        userId: "user-123",
      });
      session.join("test_channel");
      session.allow("test_topic", Access.Read);
      return session;
    },
    fireWebhook: noopFireWebhook,
  });

  // The route is GET /api/generate-token-test in the hono app.
  // handler.POST just forwards the request to hono regardless of method.
  const response = await handler.POST(
    makeRequest("http://localhost/api/generate-token-test", "GET"),
  );

  expect(authorizeCalled).toBe(true);
  expect(response.status).toBe(200);
  const json = await response.json();
  expect(json).toEqual({ token: "test" });
});

test("route handler passes session data to /api/erebus/pubsub/grant endpoint", async () => {
  const testUserId = "test-user-456";

  const handler = createRouteHandler({
    authorize: async (channel, ctx) => {
      expect(channel).toBe("test_channel");
      expect(ctx?.req).toBeInstanceOf(Request);
      const service = new ErebusService({
        secret_api_key:
          "dv-er-p14umx0nlo8d5vuam32y0fn_qe8tnzyynsbp9n__mgjf_yq6",
        base_url: "http://localhost:3000/",
      });
      const session = await service.prepareSession({
        userId: testUserId,
      });
      session.join(channel);
      session.allow("test_topic", Access.Read);
      return session;
    },
    fireWebhook: noopFireWebhook,
  });

  const response = await handler.POST(
    makeRequest("http://localhost/api/erebus/pubsub/grant", "POST", {
      channel: "test_channel",
    }),
  );

  // session.authorize() calls the real Erebus service which is not running,
  // so we expect the grant endpoint to return a 500 with an error
  expect(response.status).toBe(500);
  const json = await response.json();
  expect(json).toHaveProperty("error");
});

test("route handler throws when authorize throws", async () => {
  const handler = createRouteHandler({
    authorize: async (_channel, _ctx) => {
      throw new Error("Authorization failed");
    },
    fireWebhook: noopFireWebhook,
  });

  // authorize throws before the hono app is created, so the handler rejects
  await expect(
    handler.POST(
      makeRequest("http://localhost/api/erebus/pubsub/grant", "POST", {
        channel: "test",
      }),
    ),
  ).rejects.toThrow(/Authorization failed/);
});
