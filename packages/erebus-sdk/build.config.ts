import { defineConfig } from "tsdown";
import strip from "@rollup/plugin-strip";
import typescript from "@rollup/plugin-typescript";

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
  // Remove console and debugger on production build
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
  plugins: [
    typescript(),
    strip({
      // Strip specific logger calls in production builds
      functions: [
        "logger.info",
        "logger.warn",
        "logger.error",
        "logger.debug",
        "logger.trace",
        "logger.success",
        "logger.fail",
        "logger.ready",
        "logger.start",
        "logger.log",
        "console.*",
      ],
    }),
  ],
});
