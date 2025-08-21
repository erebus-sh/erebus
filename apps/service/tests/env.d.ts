declare module 'cloudflare:test' {
	// ProvidedEnv controls the type of `import("cloudflare:test").env`
	interface ProvidedEnv extends Env {
		CHANNEL: DurableObjectNamespace<ChannelV1>;
		PUBLIC_KEY_JWK: string;
		DEBUG: boolean;
		UPSTASH_REDIS_REST_URL: string;
		UPSTASH_REDIS_REST_TOKEN: string;
		ROOT_API_KEY: string;
	}
}
