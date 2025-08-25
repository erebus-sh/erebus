import { z } from "zod";
import { UsageEventSchema } from "./webhooks/usageRequest";

export const QueueEnvelopeSchema = z.discriminatedUnion("packetType", [
  z.object({
    packetType: z.literal("usage"),
    payload: UsageEventSchema,
  }),
]);
export type QueueEnvelope = z.infer<typeof QueueEnvelopeSchema>;
