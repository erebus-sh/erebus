import { ChannelV1 } from "@/objects/pubsub/channel";

export interface Env {
  EREBUS_QUEUE: Queue;
  CHANNEL: DurableObjectNamespace<ChannelV1>;
  PUBLIC_KEY_JWK: string;
  DEBUG: boolean;
  EREBUS_DEBUG_VERBOSE?: boolean; // Gate verbose logging in hot paths
  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;
  ROOT_API_KEY: string;
  WEBHOOK_BASE_URL: string;
  WEBHOOK_SECRET: string;
}
