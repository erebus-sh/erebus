import { expect, test } from "vitest";
import { createApp } from "@/server/app";

test("Hono server health", async () => {
  const app = createApp();
  const res = await app.request("/api/health-not-meaningful");
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ ok: true, reqId: expect.any(String) });
});
