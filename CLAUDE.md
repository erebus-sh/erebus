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
- **`.env.example` files exist** in `apps/web/`, `apps/service/`, and `workers/roadmap/`. Keep them updated when adding env vars.
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
- Service tests generate JWT tokens at runtime using a shared test key pair in `apps/service/tests/test-utils.ts`
- SDK integration tests that require external services (WebSocket, auth server) are `test.skip()`'d — unit tests run everywhere

## Development Workflow

This section documents the working patterns and lessons learned from building this codebase. Follow these to avoid known pitfalls.

### Research before writing

- **Always explore first.** Before changing any code, use agents to read the actual source files, understand the data flow, and map dependencies. Don't guess at interfaces — read them.
- **Read tests alongside source.** Tests reveal the actual contract. If a test expects `msg.payload.payload`, the wire format nests payloads — don't flatten it without updating tests.
- **Check Cloudflare docs for DO patterns.** Durable Objects are single-threaded actors — no locks, no transactions for single-key writes. The runtime guarantees exclusion. Don't add unnecessary synchronization.

### Making changes

- **Fix the tests, not just the code.** When refactoring, if tests break, the tests need updating too — they're part of the contract. Don't skip them to "fix later."
- **Run tests locally before pushing.** `bun run test` in the affected package. Service tests need `@cloudflare/vitest-pool-workers`. SDK tests need Zod inlined (`server.deps.inline: ["zod"]` in vitest config).
- **Watch for workspace dependency issues.** `workspace:*` references in `dependencies` or `devDependencies` break `bun publish`. If a package is bundled by tsdown (check `build.config.ts` external array), it doesn't belong in any dependency field — bun workspace linking resolves it during development.
- **Format before committing.** `bun run format` from root covers the entire monorepo. Lefthook also runs prettier on staged files, but a full format pass catches files not yet staged.

### Service-specific patterns (Cloudflare Workers)

- **EREBUS_ON_HOLD flag.** When `true` in wrangler.jsonc vars, the service returns 403 for all WebSocket connections. Tests must account for this — either set it to `false` in test bindings or handle the 403.
- **Test JWT tokens.** Never hardcode JWT tokens in tests — they expire. Use `apps/service/tests/test-utils.ts` which generates tokens at runtime with a static Ed25519 key pair. The matching public key is in vitest.config.ts miniflare bindings.
- **Packet schemas live in `packages/schemas/`.** When adding/changing packet types, update the Zod schema there. Both the service and SDK import from it.
- **`t_ws_write_end` can be 0 in tests.** The workerd test environment doesn't populate real monotonic timestamps. Use `toBeGreaterThanOrEqual(0)` instead of `toBeGreaterThan(0)`.

### SDK-specific patterns

- **Build SDK before testing service.** The service imports `@erebus-sh/sdk` — if the SDK dist is stale, service tests may fail with confusing import errors.
- **React SDK was removed.** The `ErebusProvider`, `TopicProvider`, `createChannel` components no longer exist in the SDK source. Tests referencing them should be deleted, not fixed.
- **`ErebusSession` validation rules.** Channel names: alphanumeric + underscore, max 64 chars. Topics: same rules, max 64 per session. API keys: must match `dv-er-` prefix + 48 alphanumeric chars. Tests must use valid formats.

### Documentation patterns

- **Docs are in `apps/docs/content/docs/` as .mdx files.** Fumadocs handles routing from the file structure.
- **Write docs from source code, not imagination.** Read the actual TypeScript types, method signatures, and error codes. If the code says `Access.ReadWrite`, the docs say `read-write` — don't invent options that don't exist.
- **Test docs build.** Run `cd apps/docs && bun run build` after writing new pages. Fumadocs will catch broken links, missing frontmatter, and MDX syntax errors.
- **Blog posts need complete frontmatter.** `title`, `description`, `author`, `date` fields are required. Check existing posts for the exact format.

### CI/CD

- **CI runs 5 jobs:** Lint, Type Check, Build, Test SDK, Test Service.
- **Lint covers the entire monorepo** via `turbo run lint`. A single ESLint error in any package fails the whole pipeline.
- **Vercel deploys are triggered on push to master.** Docs and web apps deploy automatically. If Vercel blocks a deploy (e.g., vulnerable Next.js version), the fix must be in the dependencies, not a Vercel config.
- **GPG signing is required.** All commits must be signed. The signing key is `1F4F0EDA64619E19`. If `gpg` isn't in PATH, add `/opt/homebrew/bin` to PATH.

### Committing and pushing

- **Always split commits by concern.** Config changes, code changes, test fixes, doc updates — each gets its own commit.
- **Use `--no-verify` when lefthook would re-format already-formatted code.** The pre-commit hook runs prettier on staged files, which can conflict with bulk formatting passes.
- **Verify GPG signatures before pushing:** `git log --oneline --show-signature -N` where N is the number of new commits.
- **Watch CI after pushing.** Use `gh run list --limit 1` and `gh run view <id>` to monitor. Don't assume green — check.
