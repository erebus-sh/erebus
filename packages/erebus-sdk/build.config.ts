import { defineConfig } from "tsup";
import glob from "fast-glob";

export default defineConfig({
  entry: await glob([
    "./src/**/*.ts",
    "!./src/**/*.test.ts",
    "!./src/**/*.spec.ts",
  ]),
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
  minifySyntax: true,
  minifyWhitespace: true,
  treeshake: true,
  // Path aliases for @/* to ./src/*
  esbuildOptions(options) {
    // Handle aliases
    options.alias = {
      "@/*": "./src/*",
    };
    // Drop console and debugger
    options.drop = ["console", "debugger"];
    return options;
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
