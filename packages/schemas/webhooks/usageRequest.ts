import { z } from "zod";

export const UsageEventSchema = z.object({
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

export type UsagePayload = z.infer<typeof UsageEventSchema>;
export type UsageEvent = z.infer<typeof UsageEventSchema>;
