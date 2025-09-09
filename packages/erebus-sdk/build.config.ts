import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    // Main entry point
    index: "./src/index.ts",

    // Client core
    "client/core/index": "./src/client/core/index.ts",

    // React client
    "client/react/index": "./src/client/react/index.ts",

    // Server SDK
    "server/index": "./src/server/index.ts",
    "server/adapter/next/index": "./src/server/adapter/next/index.ts",

    // Service
    "service/index": "./src/service/index.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  platform: "neutral",
  external: [
    // Dependencies
    "@hono/node-server",
    "@hono/zod-validator",
    "consola",
    "hono",
    "jose",
    "ky",
    "nanoid",
    "zod",
    // Peer dependencies
    "typescript",
    "react",
    "react/jsx-runtime",
    "zustand",
  ],
  sourcemap: true,
  clean: true,
  minify: true,
  treeshake: true,
});
