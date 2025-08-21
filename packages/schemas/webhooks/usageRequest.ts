import { z } from "zod";

export const UsagePayloadSchema = z.object({
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
export type UsagePayload = z.infer<typeof UsagePayloadSchema>;
