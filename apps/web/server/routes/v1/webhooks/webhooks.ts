import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { UsagePayloadSchema } from "@repo/schemas/webhooks/usageRequest";

export const webhooksRoute = new Hono();

webhooksRoute.post(
  "/usage",
  zValidator("json", UsagePayloadSchema),
  async (c) => {
    const body = await c.req.valid("json");
    console.log(body);
    const { event, data } = body;
    switch (event) {
      case "websocket.connect":
        throw new Error("Not implemented");
      case "websocket.message":
        throw new Error("Not implemented");
      case "websocket.subscribe":
        throw new Error("Not implemented");
      default:
        throw new Error("Unknown event");
    }
  },
);
