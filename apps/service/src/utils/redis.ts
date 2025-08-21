import { Redis } from '@upstash/redis/cloudflare';
import { Env } from '@/env';

/**
 * Get a redis client for a given region
 *
 * @param env - Environment bindings from wrangler.jsonc
 * @param region - Region to get the redis client for
 * @returns Redis client
 */
export function getRedis(env: Env): Redis {
	return new Redis({
		url: env.UPSTASH_REDIS_REST_URL,
		token: env.UPSTASH_REDIS_REST_TOKEN,
	});
}
