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

test("route handler passes session from authorize to hono app", async () => {
  // Track if authorize was called
  let authorizeCalled = false;

  const handler = createRouteHandler({
    authorize: async (channel, ctx) => {
      authorizeCalled = true;

      // Verify we receive the channel and ctx
      expect(channel).toBe("");
      expect(ctx?.req).toBeInstanceOf(Request);
      expect(ctx?.req.url).toBe("http://localhost/generate-token-test");

      const userId = "user-123";
      const service = new ErebusService({
        secret_api_key:
          "dv-er-abcdefghijklmnopqrstuvwxyzABCDEFGsH1234abcdddddd",
      });
      const session = await service.prepareSession({
        userId,
      });
      session.join("test_channel");
      session.allow("test_topic", Access.Read);
      return session;
    },
  });

  const response = await handler.POST(
    makeRequest("http://localhost/generate-token-test"),
  );

  // Verify authorize was called
  expect(authorizeCalled).toBe(true);

  // Verify response
  expect(response.status).toBe(200);
  const json = await response.json();

  // The endpoint should return a token since session is available
  expect(json).toEqual({
    token: "test",
  });
});

test("route handler passes session data to /generate-token endpoint", async () => {
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
  });

  const response = await handler.POST(
    makeRequest("http://localhost/generate-token", "POST", {
      channel: "test_channel",
    }),
  );

  expect(response.status).toBe(200);
  const json = await response.json();

  // This endpoint should return both token and userId from the session
  expect(json).toHaveProperty("grant_jwt");
});

test("route handler returns error when authorize throws error", async () => {
  const handler = createRouteHandler({
    authorize: async (_channel, _ctx) => {
      throw new Error("Authorization failed");
    },
  });

  const response = await handler.POST(
    makeRequest("http://localhost/generate-token-test"),
  );

  expect(response.status).toBe(500);
  const json = await response.json();
  expect(json).toHaveProperty("error");
  expect(json.error).toMatch(/Authorization failed/);
});
