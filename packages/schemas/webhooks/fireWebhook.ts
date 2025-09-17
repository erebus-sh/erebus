import { z } from "zod";
import { MessageBodySchema } from "../messageBody";

export const FireWebhookSchema = z.object({
  messageBody: z.array(MessageBodySchema),
  hmac: z.string(),
});

export type FireWebhookSchema = z.infer<typeof FireWebhookSchema>;
