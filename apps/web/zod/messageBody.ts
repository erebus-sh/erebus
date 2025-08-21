import { z } from "zod";

// Preserve server-provided timestamp; coerce string/number/Date into Date
export const MessageBodySchema = z
  .object({
    id: z.string(), // globally unique, assigned by Erebus
    topic: z.string().min(1), // room / topic (trust **our** routing, not client)
    senderId: z.string().min(1), // derived from JWT / session
    seq: z.string().min(1), // monotonic per channel
    sentAt: z.coerce.date(), // server clock - set ONCE at ingress time, never overwritten
    payload: z.string(), // string or object - allows client correlation data
    // Performance instrumentation timestamps (optional, only in debug mode) - ALL MONOTONIC
    t_ingress: z.number().optional(), // high-res timestamp when message received
    t_enqueued: z.number().optional(), // after auth/routing, ready to broadcast
    t_broadcast_begin: z.number().optional(), // before first socket write
    t_ws_write_end: z.number().optional(), // after all socket writes complete
    t_broadcast_end: z.number().optional(), // after all subscriber writes for this message are done
    // Client-side correlation fields (optional)
    clientMsgId: z.uuid().optional(), // client-generated correlation id
    clientPublishTs: z.number().optional(), // client publish timestamp (wall clock ms since epoch)
  })
  .strict();

export type MessageBody = z.infer<typeof MessageBodySchema>;
