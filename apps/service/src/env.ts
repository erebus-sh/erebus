import { ChannelV1 } from '@/objects/pubsub/channel';
import { QueueEnvelope } from '@/schemas/queueEnvelope';

export interface Env {
	EREBUS_QUEUE: Queue;
	CHANNEL: DurableObjectNamespace<ChannelV1>;
	PUBLIC_KEY_JWK: string;
	DEBUG: boolean;
	EREBUS_DEBUG_VERBOSE?: boolean; // Gate verbose logging in hot paths
	UPSTASH_REDIS_REST_URL: string;
	UPSTASH_REDIS_REST_TOKEN: string;
	ROOT_API_KEY: string;
}
