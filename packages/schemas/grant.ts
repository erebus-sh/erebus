import { z } from "zod";

/**
 * Grant scope enum for read, write, read-write and huh?
 */
export enum Access {
  Read = "read",
  Write = "write",
  ReadWrite = "read-write",
  Huh = "huh?",
}

export const GrantScopeEnum = z.enum(
  Object.values(Access) as [string, ...string[]],
);
export type GrantScope = z.infer<typeof GrantScopeEnum>;

/**
 * This is the grant for connection to the channel.
 */
export const GrantSchema = z.object({
  // Project data
  project_id: z.string(),
  key_id: z.string(),

  // Channel data
  channel: z.string(),
  // Topics: contain everything the user is allowed to subscribe to, or a wildcard "*"
  topics: z.array(
    z.object({
      topic: z.string(),
      scope: GrantScopeEnum,
    }),
  ),

  // Client data
  userId: z.string().min(1), // The actor making the request

  // Token metadata
  issuedAt: z.number(), // When token was issued
  expiresAt: z.number(),
});

export type Grant = z.infer<typeof GrantSchema>;
