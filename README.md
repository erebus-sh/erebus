![Erebus](./images/Banner%20-%20Github%20-%201.png)

<h1 align="center" style="font-size:2em; font-weight:bold;">
  <b>Erebus</b>
</h1>
<p align="center">
  The real-time infrastructure at the edge.
</p>

<p align="center">
  <code>bun install @erebus-sh/sdk@latest</code>
</p>

# What is this?

Erebus is real-time infrastructure at the edge.
It's a managed service, not a framework — you don't stitch together pieces, we give you the building blocks.

Erebus provides simple primitives and abstractions on top of Cloudflare Durable Objects, making it cheap, fast, and globally distributed by default. You focus on building your app; we handle the real-time plumbing.

Built with Bun, TypeScript, and React, Erebus is designed to feel lightweight, modern, and developer-friendly. This is a community-driven project, and it will keep improving as more developers use it, break it, and push it forward.

## Why Erebus

Most real-time platforms today fall into one of these problems:

- Too expensive | pricing that makes it hard to even start small.
- Too complex | you don't really know what's happening under the hood.
- Too outdated | they don't fit modern development practices, or expect you to build too much yourself.

Erebus is built to avoid all three.

## Packages

| Package                      | Description                        | README                                       |
| ---------------------------- | ---------------------------------- | -------------------------------------------- |
| `apps/web`                   | Next.js dashboard + Convex backend | [README](./apps/web/README.md)               |
| `apps/docs`                  | Fumadocs documentation site        | [README](./apps/docs/README.md)              |
| `apps/service`               | Cloudflare Workers edge gateway    | [README](./apps/service/README.md)           |
| `packages/erebus-sdk`        | Published SDK (`@erebus-sh/sdk`)   | [README](./packages/erebus-sdk/README.md)    |
| `packages/schemas`           | Shared Zod validation schemas      | [README](./packages/schemas/README.md)       |
| `packages/shared`            | Shared utilities                   | [README](./packages/shared/README.md)        |
| `packages/eslint-config`     | Shared ESLint flat config          | [README](./packages/eslint-config/README.md) |
| `packages/typescript-config` | Shared tsconfig base configs       | —                                            |
| `workers/roadmap`            | Roadmap Cloudflare Worker          | [README](./workers/roadmap/README.md)        |

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) v1.2.19+ (see `packageManager` in package.json)
- Node.js >= 18
- A [Convex](https://convex.dev) account (for apps/web)
- A [Cloudflare](https://cloudflare.com) account (for apps/service and workers)

### Setup

```bash
# Install dependencies
bun install

# Copy environment files and fill in values
cp apps/web/.env.example apps/web/.env.local
cp apps/service/.env.example apps/service/.dev.vars
cp workers/roadmap/.env.example workers/roadmap/.dev.vars

# Start all services in development mode
bun run dev
```

## Environment Variables

Each app has its own `.env.example` file documenting all required and optional variables:

- [`apps/web/.env.example`](./apps/web/.env.example) — Convex, JWT keys, PostHog, Polar
- [`apps/service/.env.example`](./apps/service/.env.example) — Redis, webhooks, API keys
- [`workers/roadmap/.env.example`](./workers/roadmap/.env.example) — GitHub token

## Scripts

| Script                | Description                            |
| --------------------- | -------------------------------------- |
| `bun run dev`         | Start all services in development mode |
| `bun run build`       | Build all packages via Turborepo       |
| `bun run lint`        | Lint all packages                      |
| `bun run format`      | Format all files with Prettier         |
| `bun run check-types` | Type-check all packages                |

## Examples

See the [`examples/`](./examples/) directory for usage examples:

- **chat-app** — Next.js chat application (port 3002)
- **chat-ts** — Plain TypeScript chat client
- **chat-ts-typed** — Typed TypeScript chat client
- **chat-tui** — Terminal UI chat client

# Contribution

Erebus is a free and open-source project, licensed under the AGPL.
You're free to use it, self-host it, or build on top of it.

You can support the project by:

- [Contributing to the source code](./CONTRIBUTING.md)
- [Suggesting new features or reporting issues](https://github.com/erebus-sh/erebus/issues)

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development workflow and coding guidelines.

## Security

If you discover a security vulnerability in Erebus, please report it by emailing [security@erebus.sh](mailto:security@erebus.sh).

All reports will be reviewed quickly, and we'll make sure to credit you for your discovery.
