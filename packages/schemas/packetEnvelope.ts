import { z } from "zod";
import { MessageBodySchema } from "./messageBody";

/** Optional but recommended: correlate requests ↔ acks */
const RequestId = z.string().min(1).optional();

/** Client → Server */
const ConnectPacket = z.object({
  packetType: z.literal("connect"),
  grantJWT: z.string().min(1),
});

const SubscribePacket = z.object({
  packetType: z.literal("subscribe"),
  requestId: RequestId,
  topic: z.string().min(1),
});

const UnsubscribePacket = z.object({
  packetType: z.literal("unsubscribe"),
  requestId: RequestId,
  topic: z.string().min(1),
});

const PublishPacket = z.object({
  packetType: z.literal("publish"),
  ack: z.boolean().optional(),
  requestId: RequestId,
  topic: z.string().min(1),
  payload: MessageBodySchema,
  clientMsgId: z.string().min(1), // for idempotency (required for ACKs)
});

/** Server → Client (ACK) */
// Base ACK structure - all ACKs start with type "ack"
const BaseAck = z.object({
  type: z.literal("ack"),
  path: z.enum(["publish", "subscribe", "unsubscribe"]),
  seq: z.string().min(1),
  serverAssignedId: z.string().min(1),
  clientMsgId: z.string().min(1),
});

// Publish ACK - success case
const AckPublishOk = BaseAck.extend({
  path: z.literal("publish"),
  topic: z.string().min(1),
  result: z.object({
    ok: z.literal(true),
    serverMsgId: z.string().min(1),
    t_ingress: z.number(), // ms epoch
  }),
});

// Publish ACK - error case
const AckPublishErr = BaseAck.extend({
  path: z.literal("publish"),
  topic: z.string().min(1),
  result: z.object({
    ok: z.literal(false),
    code: z.enum([
      "UNAUTHORIZED",
      "FORBIDDEN",
      "INVALID",
      "RATE_LIMITED",
      "INTERNAL",
    ]),
    message: z.string().min(1),
  }),
});

// Subscribe/Unsubscribe ACK
const AckSubscription = BaseAck.extend({
  path: z.enum(["subscribe", "unsubscribe"]),
  topic: z.string().min(1),
  result: z.object({
    ok: z.literal(true),
    status: z.enum(["subscribed", "unsubscribed"]),
  }),
});

/** Master ACK union discriminated by path */
const AckTypeSchema = z.discriminatedUnion("path", [
  AckPublishOk,
  AckPublishErr,
  AckSubscription,
]);

const AckPacket = z.object({
  packetType: z.literal("ack"),
  requestId: RequestId, // echo whatever the client sent (or null/undefined)
  type: AckTypeSchema,
});

/** Master envelope */
export const PacketEnvelopeSchema = z.discriminatedUnion("packetType", [
  ConnectPacket,
  SubscribePacket,
  UnsubscribePacket,
  PublishPacket,
  AckPacket,
]);

export type PacketEnvelope = z.infer<typeof PacketEnvelopeSchema>;

// Export individual packet types
export type ConnectPacketType = z.infer<typeof ConnectPacket>;
export type SubscribePacketType = z.infer<typeof SubscribePacket>;
export type UnsubscribePacketType = z.infer<typeof UnsubscribePacket>;
export type PublishPacketType = z.infer<typeof PublishPacket>;
export type AckPacketType = z.infer<typeof AckPacket>;

// Export ACK types
export type AckType = z.infer<typeof AckTypeSchema>;
export type AckPublishOkType = z.infer<typeof AckPublishOk>;
export type AckPublishErrType = z.infer<typeof AckPublishErr>;
export type AckSubscriptionType = z.infer<typeof AckSubscription>;

// Export base ACK structure
export type BaseAckType = z.infer<typeof BaseAck>;
