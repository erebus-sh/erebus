import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    // Main entry
    "./src/index.ts",

    // Client entries
    "./src/client/core/Erebus.ts",
    "./src/client/core/pubsub/ErebusPubSubClientNew.ts",
    "./src/client/core/pubsub/PubSubConnectionNew.ts",
    "./src/client/core/pubsub/ConnectionManager.ts",
    "./src/client/core/pubsub/AckManager.ts",
    "./src/client/core/pubsub/SubscriptionManager.ts",
    "./src/client/core/pubsub/MessageProcessor.ts",
    "./src/client/core/pubsub/GrantManager.ts",
    "./src/client/core/pubsub/HeartbeatManager.ts",
    "./src/client/core/pubsub/StateManager.ts",
    "./src/client/core/errors.ts",
    "./src/client/core/types.ts",
    "./src/client/core/utils.ts",

    // React entries
    "./src/client/react/index.ts",
    "./src/client/react/utils/createErebus.ts",
    "./src/client/react/hooks/index.ts",
    "./src/client/react/hooks/useMessagesState.ts",
    "./src/client/react/hooks/useAutoSubscribe.ts",
    "./src/client/react/hooks/useMessagePublisher.ts",
    "./src/client/react/hooks/useMessagesStatusSync.ts",
    "./src/client/react/store/erebus.ts",
    "./src/client/react/utils/index.ts",

    // Server entries
    "./src/server/app.ts",
    "./src/server/rpc.ts",
    "./src/server/adapter/next/createRouteHandler.ts",

    // Service entries
    "./src/service/Service.ts",
    "./src/service/baseClient.ts",
    "./src/service/session.ts",
    "./src/service/error.ts",
    "./src/service/patterns.ts",

    // Internal entries
    "./src/internal/lib/jwt.ts",
    "./src/internal/constants.ts",
    "./src/internal/enums/wserrors.ts",
  ],
  format: ["esm", "cjs"],
  dts: true,
  external: [
    // Dependencies
    "@hono/node-server",
    "@hono/zod-validator",
    "consola",
    "hono",
    "jose",
    "ky",
    "nanoid",
    "unbuild",
    "zod",
    // Peer dependencies
    "typescript",
    "react",
    "zustand",
  ],
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: true,
  treeshake: true,
  // Path aliases for @/* to ./src/*
  esbuildOptions(options) {
    options.alias = {
      "@/*": "./src/*",
    };
  },
  // Generate TypeScript declaration maps after build
  onSuccess: async () => {
    const { execSync } = await import("child_process");
    try {
      execSync("tsc --emitDeclarationOnly --declaration", {
        stdio: "inherit",
        cwd: process.cwd(),
      });
      console.log("✅ TypeScript declaration maps generated successfully");
    } catch (error) {
      console.error(
        "❌ Failed to generate TypeScript declaration maps:",
        error,
      );
      process.exit(1);
    }
  },
});
