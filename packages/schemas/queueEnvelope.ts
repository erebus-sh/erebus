import { z } from "zod";
import { UsagePayloadSchema } from "./webhooks/usageRequest";

export const QueueEnvelopeSchema = z.discriminatedUnion("packetType", [
  z.object({
    packetType: z.literal("usage"),
    payload: UsagePayloadSchema,
  }),
]);
export type QueueEnvelope = z.infer<typeof QueueEnvelopeSchema>;
