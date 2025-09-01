# Erebus SDK (Beta)

Welcome to the official Erebus SDK package. Please refer to the documentation to get started at [docs](https://docs.erebus.sh/docs).

## Install

You can install erebus-sdk using your favorite package manager:

```bash
npm install erebus-sdk
# or
pnpm install erebus-sdk
# or
bun add erebus-sdk
```

## What is this?

This SDK provides type safety you can trust, Zod at the core. And application interfaces to interact with the Erebus infrastructure.

## Available primitives

- [Pub/Sub Channels](https://docs.erebus.sh/docs/primitives/pubsub/)
- Live state (coming soon)
- AI streams (coming soon)
- Multiplier verticals (coming soon)

## Quickstart example

```typescript
import { createErebus } from "@/client/react/utils/createErebus";
import { z } from "zod";

const channels = {
  room: z.object({
    message: z.string(),
    sentAt: z.number(),
  }),
};

const { useSubscribe } = createErebus(channels);

export default useSubscribe;
```

## Documentation

Full SDK documentation is available on the official [documentation website](https://docs.erebus.sh/docs/primitives/pubsub/).
