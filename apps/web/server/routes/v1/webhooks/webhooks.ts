import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

export const webhooksRoute = new Hono();

export const usagePayload = z.object({
  event: z.enum([
    "websocket.connect",
    "websocket.message",
    "websocket.subscribe",
  ]),
  data: z.object({
    projectId: z.string(),
    payloadLength: z.number(),
  }),
});

webhooksRoute.post("/usage", zValidator("json", usagePayload), async (c) => {
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
});
