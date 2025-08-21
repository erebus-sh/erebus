import { z } from "zod";

export const QueueEnvelopeSchema = z.discriminatedUnion("packetType", [
  z.object({
    packetType: z.literal("usage"),
    payload: z.object({
      projectId: z.string(),
      channelName: z.string(),
      topic: z.string(),
      message: z.string(),
      event: z
        .enum(["websocket.connect", "websocket.subscribe", "websocket.message"])
        .optional(),
    }),
  }),
]);
export type QueueEnvelope = z.infer<typeof QueueEnvelopeSchema>;
