import { z } from 'zod';
import { MessageBodySchema } from './messageBody';

/** Optional but recommended: correlate requests ↔ acks */
const RequestId = z.string().min(1).optional();

/** Client → Server */
const ConnectPacket = z.object({
	packetType: z.literal('connect'),
	grantJWT: z.string().min(1),
});

const SubscribePacket = z.object({
	packetType: z.literal('subscribe'),
	requestId: RequestId,
	topic: z.string().min(1),
});

const UnsubscribePacket = z.object({
	packetType: z.literal('unsubscribe'),
	requestId: RequestId,
	topic: z.string().min(1),
});

const PublishPacket = z.object({
	packetType: z.literal('publish'),
	requestId: RequestId,
	topic: z.string().min(1),
	payload: MessageBodySchema,
	clientMsgId: z.string().min(1).optional(), // for idempotency (optional)
});

/** Server → Client (ACK) */
// We keep one "ack" envelope, with a nested discriminated union on "type".
const AckSubscribe = z.object({
	type: z.literal('subscribe'),
	topic: z.string().min(1),
	status: z.enum(['subscribed', 'unsubscribed']),
});

// For publish we allow success OR error, while still discriminating on "type".
const AckPublishOk = z.object({
	type: z.literal('publish'),
	topic: z.string().min(1),
	result: z.object({
		ok: z.literal(true),
		serverMsgId: z.string().min(1),
		seq: z.string().min(1),
		t_ingress: z.number(), // ms epoch (or ISO if you prefer string)
	}),
});

const AckPublishErr = z.object({
	type: z.literal('publish'),
	topic: z.string().min(1),
	result: z.object({
		ok: z.literal(false),
		code: z.enum([
			'UNAUTHORIZED',
			'FORBIDDEN',
			'INVALID',
			'RATE_LIMITED',
			'INTERNAL',
			// add more as needed
		]),
		message: z.string().min(1),
	}),
});

/** "type" is the discriminator here */
const AckTypeSchema = z.discriminatedUnion('type', [AckSubscribe, AckPublishOk, AckPublishErr]);

const AckPacket = z.object({
	packetType: z.literal('ack'),
	requestId: RequestId, // echo whatever the client sent (or null/undefined)
	type: AckTypeSchema,
});

/** Master envelope */
export const PacketEnvelopeSchema = z.discriminatedUnion('packetType', [
	ConnectPacket,
	SubscribePacket,
	UnsubscribePacket,
	PublishPacket,
	AckPacket,
]);

export type PacketEnvelope = z.infer<typeof PacketEnvelopeSchema>;
