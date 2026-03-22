# CLAUDE.md

## Project Overview

Erebus is a real-time infrastructure platform built on Cloudflare Durable Objects. It provides managed primitives (pub/sub channels, presence, history) so developers can add real-time features without managing WebSockets, message brokers, or sequencing logic. Licensed under AGPL-3.0.

## Tech Stack

- **Runtime**: Bun 1.2.19 (Node >=18 compat)
- **Package manager**: bun (always use `bun`, never npm/yarn/pnpm)
- **Language**: TypeScript 5.9.2 (strict mode)
- **Monorepo orchestration**: Turborepo 2.5.6
- **Web app**: Next.js (apps/web) with Convex backend
- **Docs**: Next.js + Fumadocs (apps/docs)
- **Edge service**: Cloudflare Workers + Durable Objects + Hono (apps/service)
- **SDK**: @erebus-sh/sdk — TypeScript-first, built with tsdown
- **Database**: Convex (primary), Upstash Redis (caching/rate-limiting)
- **Linting**: ESLint 9 flat config
- **Formatting**: Prettier 3.6.2 (+ Tailwind plugin in apps/web)
- **Testing**: Vitest 3.2.x
- **Git hooks**: Lefthook (pre-commit: format + lint + wrangler types, commit-msg: commitlint)

## Monorepo Structure

```
apps/
  web/         → Next.js dashboard + Convex backend (port 3000)
  docs/        → Fumadocs documentation site (port 3001)
  service/     → Cloudflare Workers gateway (gateway.erebus.sh, port 8787)
packages/
  erebus-sdk/  → Published SDK (@erebus-sh/sdk)
  schemas/     → Shared Zod schemas
  shared/      → Shared utilities
  eslint-config/       → Shared ESLint flat config
  typescript-config/   → Shared tsconfig base configs
workers/
  roadmap/     → Cloudflare Worker for roadmap (roadmap.erebus.sh, port 8788)
examples/
  chat-app/    → Next.js chat example (port 3002)
  chat-ts/     → Plain TypeScript chat example
  chat-ts-typed/ → Typed TypeScript chat example
  chat-tui/    → Terminal UI chat example
```

## Common Commands

```bash
bun install           # Install all dependencies
bun run dev           # Start all services in development mode (via Turbo)
bun run build         # Build all packages (via Turbo)
bun run lint          # Lint all packages
bun run format        # Format all files with Prettier
bun run check-types   # Type-check all packages
```

### Per-package commands

```bash
# apps/web — runs Convex + Next.js concurrently
cd apps/web && bun run dev

# apps/service — generates CF types then starts wrangler
cd apps/service && bun run dev

# SDK — clean build
cd packages/erebus-sdk && bun run build

# SDK tests
cd packages/erebus-sdk && bun run test        # Node tests
cd packages/erebus-sdk && bun run test:react   # jsdom tests

# Service tests (uses Cloudflare Workers test pool)
cd apps/service && bun run test
```

## Code Conventions

### Imports

- Path alias `@/` maps to app/package root (configured per tsconfig)
- Use `@/` for all non-relative imports within an app
- Relative imports only within the same directory subtree
- Barrel files (index.ts) used strategically for public API surfaces

### File naming

- **kebab-case** for component files and routes: `create-project-dialog.tsx`, `[user-slug]/`
- **PascalCase** for class files: `ErebusClient.ts`, `MessageBroadcaster.ts`
- **camelCase** for utility files: `useNavStackStore.ts`
- Test files use `.test.ts` suffix

### Exports

- Named exports preferred for utilities, classes, and types
- `export default function` for React page/component files
- Type-only exports: `export type { SomeType }`
- Barrel files organize exports with comment section headers

### Error handling

- Custom error classes extending Error: `NotConnectedError`, `BackpressureError`, `AuthError`
- `ConvexError` for database operation errors
- try/catch with `instanceof` checks for error type discrimination
- `logError()` utility for structured error logging

### API patterns

- Hono.js for routing in apps/service and SDK server
- Zod validation via `zValidator()` middleware
- Response shape: `{ ok: true, reqId }` or `{ error: string, reqId }` with appropriate HTTP status
- Grant JWT tokens for channel authentication

### React patterns

- Server components by default, `"use client"` directive only when needed
- Convex hooks: `useMutation()`, `useQuery()` with `api.*` references
- Zustand for client-side state management
- Props typed inline: `({ projects }: { projects: Doc<"projects">[] })`

### Convex patterns

- Schema in `convex/schema.ts`, tables split into `convex/tables/`
- Mutations: `mutation({ args: { ... }, handler: async (ctx, args) => { ... } })`
- Queries: `query({ args: { ... }, handler: async (ctx, args) => { ... } })`
- Auth guards: `getAuthenticatedUser()`, `getValidatedProjectWithOwnership()`
- Index queries: `.withIndex("by_field", (q) => q.eq("field", value))`
- Audit logging via `audit()` utility

### Service patterns (Cloudflare Workers)

- Class-based Durable Objects: `ChannelV1` with SQLite storage
- **Composition over inheritance**: Managers use `ServiceContext` + standalone utility functions (not class hierarchy)
- Utility modules: `service-utils.ts` (storage, logging, queue), `ack-utils.ts` (ACK factories)
- **In-memory caching**: SubscriptionManager, SequenceManager, ShardManager cache hot data with lazy hydration from storage
- **No unnecessary transactions**: Single-threaded DO model provides exclusion; transactions only for multi-key atomic writes
- **DO alarm-based TTL cleanup**: MessageBuffer schedules alarms instead of inline pruning
- **Pre-serialized broadcasts**: Messages serialized once, Set-based subscriber lookups (O(1))
- Static factory methods: `fromWebSocket()`, `withGrant()`
- Getters for computed properties on classes
- Region-local ULIDs for monotonic ordering

## Git Conventions

### Commit style (conventional commits)

- Format: `type(scope): lowercase description`
- Types: `feat`, `fix`, `refactor`, `chore`, `docs`, `config`, `test`
- Scope is optional but encouraged (e.g., `feat(sdk):`, `fix(roadmap):`, `chore(web):`)
- Description must be lowercase and imperative mood
- Examples:
  - `feat(sdk): add presence tracking to channel client`
  - `fix(service): correct WebSocket reconnection backoff`
  - `chore: update dependencies in bun.lock`
  - `docs(web): add environment variable documentation`

### Atomic commits — MANDATORY

- **NEVER combine multiple unrelated changes into a single commit.**
- Each commit must be small, focused, and address exactly ONE concern.
- Multiple smaller commits are ALWAYS preferred over one large commit.
- If a task touches multiple areas (e.g., a feature + its tests + docs), each gets its own commit.
- When asked to commit, create separate commits per logical change — do not batch.

### Pull requests

- PRs are ALWAYS squash-merged — the PR title becomes the final commit message.
- PR title MUST follow the same conventional commit format: `type(scope): description`
- The PR body/description provides the detail, not the title.
- Keep PR titles under 70 characters.

## Important Files

- `turbo.json` — Turborepo task config (build, lint, check-types, dev)
- `apps/web/convex/schema.ts` — Convex database schema
- `apps/web/convex/auth.config.ts` — Authentication configuration
- `apps/service/src/env.ts` — Cloudflare Worker environment interface
- `apps/service/src/objects/pubsub/` — Core pub/sub Durable Object implementation
- `apps/service/src/objects/pubsub/service-utils.ts` — Shared storage, logging, queue utilities
- `apps/service/src/objects/pubsub/ack-utils.ts` — ACK packet factory functions
- `packages/erebus-sdk/src/client/core/` — SDK client core (main public API)
- `packages/erebus-sdk/build.config.ts` — SDK build configuration (tsdown)
- `packages/typescript-config/` — Shared tsconfig base files

## Things to Watch Out For

- **Always use `bun`** — never npm/yarn/pnpm. The lockfile is `bun.lock`.
- **Build SDK before service**: `apps/service/build` depends on `@erebus-sh/sdk` being built first.
- **Wrangler types**: Run `bun run cf-typegen` in apps/service after changing wrangler.jsonc bindings.
- **Convex dev**: `apps/web` dev runs Convex and Next.js concurrently via `concurrently`.
- **Pre-commit hook**: Lefthook runs format (prettier), lint (eslint), and wrangler types in parallel.
- **Commit-msg hook**: Commitlint enforces conventional commit format (`type(scope): description`).
- **No .env.example checked in** — environment variables are documented in each app's README.
- **EREBUS_ON_HOLD**: Feature flag that disables project creation in the UI.
- **AGPL license**: All contributions must be AGPL-compatible.

## Environment Variables

See `.env.example` files in each app directory for required variables:

- `apps/web/.env.example` — Convex, PostHog, Polar, JWT keys
- `apps/service/.env.example` — Redis, webhooks, API keys, JWT public key
- `workers/roadmap/.env.example` — GitHub token

## Testing

- **Vitest** is the test runner across all packages
- `apps/service` uses `@cloudflare/vitest-pool-workers` for Worker-native tests
- `packages/erebus-sdk` has separate Node (`vitest.config.ts`) and jsdom (`vitest.jsdom.config.ts`) configs
- `apps/web` uses `convex-test` for Convex backend testing
