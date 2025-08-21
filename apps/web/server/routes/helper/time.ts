import { Hono } from "hono";

export const timeRoute = new Hono();

timeRoute.get("/time", (c) => {
  const now = new Date();
  return c.json({
    serverTime: now.toISOString(),
    unix: now.getTime(),
  });
});
