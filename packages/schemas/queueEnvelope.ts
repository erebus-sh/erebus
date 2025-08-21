import { z } from 'zod';

export const QueueEnvelopeSchema = z.discriminatedUnion('packetType', [
	z.object({
		packetType: z.literal('usage'),
		payload: z.object({
			projectId: z.string(),
			channelName: z.string(),
			topic: z.string(),
			message: z.string(),
		}),
	}),
]);
export type QueueEnvelope = z.infer<typeof QueueEnvelopeSchema>;
