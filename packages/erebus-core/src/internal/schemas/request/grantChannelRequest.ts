import { z } from "zod";
import { GrantScopeEnum } from "../grant";

const SECRET_KEY_REGEX = /^(sk-er-|dv-er-)[\w-]{48}$/;

export const secretKeySchema = z
  .string()
  .min(1)
  .regex(SECRET_KEY_REGEX, "Invalid API key format");
/**
 * This grant only grant you connection to the channel, but don't grant you to subscribe to any topic in the channel.
 * You need to grant the topic access separately.
 */
export const grantRequestSchema = z.object({
  secret_key: secretKeySchema,
  // Channel data
  channel: z.string().min(1),
  // Topics: contain everything the user is allowed to subscribe to, or a wildcard "*"
  topics: z
    .array(
      z.object({
        topic: z.string(),
        scope: GrantScopeEnum,
      }),
    )
    .min(1),
  userId: z.string().min(1),
  expiresAt: z.number(),
});

export type GrantRequest = z.infer<typeof grantRequestSchema>;
