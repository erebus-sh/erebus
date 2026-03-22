# @repo/service

The Erebus edge gateway — a Cloudflare Workers service that handles real-time WebSocket connections, pub/sub message routing, and channel management using Durable Objects.

## Tech Stack

- **Cloudflare Workers** — Edge runtime
- **Durable Objects** (SQLite-backed) — Stateful channel coordination
- **Hono** — HTTP routing framework
- **Upstash Redis** — Rate limiting and caching
- **KV Namespaces** — Edge caching layer

## Architecture

```
src/
  index.ts          → Worker entry point and Hono app
  env.ts            → Environment variable interface (Env)
  objects/
    pubsub/         → Core pub/sub Durable Object implementation
      channel.ts    → ChannelV1 Durable Object class
      ErebusClient.ts → Client connection handler
      MessageBroadcaster.ts → Message fan-out logic
      SequenceManager.ts    → ULID-based ordering
  analytics/        → Usage tracking
tests/
  pubsub.test.ts    → Integration tests (Cloudflare Workers pool)
  env.d.ts          → Test environment types
```

### Key concepts

- **ChannelV1**: A Durable Object class with SQLite storage that manages a single pub/sub channel. Handles WebSocket connections, message ordering, history, and presence.
- **Grant JWTs**: Clients authenticate via short-lived JWTs signed by the web app and verified by the service using the shared public key.
- **Region-local ULIDs**: Monotonic, sortable message IDs generated per-region without a central bottleneck.

## Development

```bash
# From repo root
bun run dev  # Starts all services

# From this directory
bun run dev  # Generates CF types, then starts wrangler dev on port 8787
```

## Environment Variables

See [.env.example](./.env.example) for the full list. For local development, Cloudflare Workers uses `.dev.vars` for secrets:

```bash
# Copy .env.example to .dev.vars for local development
cp .env.example .dev.vars
```

| Variable | Required | Description |
|----------|----------|-------------|
| `PUBLIC_KEY_JWK` | Yes | EC P-256 JWK for verifying grant tokens |
| `ROOT_API_KEY` | Yes | Admin API key |
| `UPSTASH_REDIS_REST_URL` | Yes | Upstash Redis REST endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | Yes | Upstash Redis REST token |
| `WEBHOOK_BASE_URL` | Yes | Base URL for webhook delivery |
| `WEBHOOK_SECRET` | Yes | HMAC secret for webhooks |

## Scripts

| Script | Description |
|--------|-------------|
| `dev` | Generate types + start wrangler dev (port 8787) |
| `build` | Build SDK dependency then wrangler build |
| `test` | Run Vitest with Cloudflare Workers pool |
| `deploy` | Deploy to Cloudflare production |
| `preview` | Deploy to Cloudflare preview environment |
| `cf-typegen` | Generate TypeScript types from wrangler.jsonc |
