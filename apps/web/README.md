# @repo/web

The Erebus dashboard — a Next.js web application backed by Convex for project management, API key provisioning, usage analytics, and billing.

## Tech Stack

- **Next.js** (App Router + Turbopack) — Server and client rendering
- **Convex** — Backend database, real-time queries, mutations, and auth
- **Tailwind CSS** — Styling
- **Zustand** — Client-side state management
- **PostHog** — Product analytics
- **Polar** — Payments and subscriptions

## Architecture

```
app/              → Next.js App Router pages and layouts
  (app)/          → Authenticated app routes (dashboard, projects, settings)
  (marketing)/    → Public marketing pages
components/       → Shared React components
  ui/             → shadcn/ui primitives
convex/           → Convex backend
  tables/         → Table definitions (split per table)
  schema.ts       → Database schema (imports from tables/)
  auth.config.ts  → Authentication configuration
  lib/            → Convex utilities (polar, analytics)
server/           → Server-side API routes
  routes/v1/      → REST API endpoints (grant, webhooks)
lib/              → Client utilities
scripts/          → Development scripts (key generation)
```

## Development

```bash
# From repo root
bun run dev  # Starts all apps including web

# From this directory (runs Convex + Next.js concurrently)
bun run dev
```

The dev command starts both the Convex development server and Next.js with Turbopack on port 3000.

## Environment Variables

See [.env.example](./.env.example) for the full list. Key variables:

| Variable                   | Required | Description                             |
| -------------------------- | -------- | --------------------------------------- |
| `NEXT_PUBLIC_CONVEX_URL`   | Yes      | Convex deployment URL                   |
| `PRIVATE_KEY_JWK`          | Yes      | EC P-256 JWK for signing grant tokens   |
| `PUBLIC_KEY_JWK`           | Yes      | EC P-256 JWK for verifying grant tokens |
| `WEBHOOK_SECRET`           | Yes      | HMAC secret for webhook validation      |
| `ACTION_SECRET`            | Yes      | Secret for internal action calls        |
| `POLAR_ORGANIZATION_TOKEN` | Yes      | Polar API token                         |
| `POLAR_SERVER`             | Yes      | `sandbox` or `production`               |
| `NEXT_PUBLIC_POSTHOG_KEY`  | Yes      | PostHog project API key                 |

Generate JWT key pairs with:

```bash
bun run scripts/generate_keys.ts
```

## Scripts

| Script          | Description                         |
| --------------- | ----------------------------------- |
| `dev`           | Start Convex + Next.js concurrently |
| `build`         | Build Next.js app                   |
| `lint`          | ESLint check                        |
| `test`          | Run Vitest in watch mode            |
| `test:once`     | Run Vitest once                     |
| `test:coverage` | Run tests with coverage report      |
| `generate-keys` | Generate EC P-256 JWK key pair      |
