import { defineConfig } from "tsup";

export default defineConfig([
  // ---- Main entry point ----
  {
    entry: {
      index: "./src/index.ts",
    },
    format: ["esm", "cjs"],
    outExtension({ format }) {
      return {
        js: format === "esm" ? ".mjs" : ".cjs",
      };
    },
    dts: true,
    target: "es2022",
    external: [
      "consola",
      "ky",
      "nanoid",
      "zod",
      "react",
      "zustand",
      "@hono/node-server",
      "@hono/zod-validator",
      "hono",
      "jose",
    ],
    splitting: false,
    sourcemap: true,
    clean: true,
    minify: true,
    minifySyntax: true,
    minifyWhitespace: true,
    treeshake: true,
    esbuildOptions(options) {
      options.alias = {
        "@/*": "./src/*",
      };
      options.drop = ["console", "debugger"];
      return options;
    },
  },

  // ---- Client Core ----
  {
    entry: {
      "client/core/index": "./src/client/core/index.ts",
    },
    format: ["esm", "cjs"],
    outExtension({ format }) {
      return {
        js: format === "esm" ? ".mjs" : ".cjs",
      };
    },
    dts: true,
    target: "es2022",
    external: ["consola", "ky", "nanoid", "zod"],
    splitting: false,
    sourcemap: true,
    clean: false, // Don't clean since we have multiple builds
    minify: true,
    minifySyntax: true,
    minifyWhitespace: true,
    treeshake: true,
    esbuildOptions(options) {
      options.alias = {
        "@/*": "./src/*",
      };
      options.drop = ["console", "debugger"];
      return options;
    },
  },

  // ---- React Client ----
  {
    entry: {
      "client/react/index": "./src/client/react/index.ts",
    },
    format: ["esm", "cjs"],
    outExtension({ format }) {
      return {
        js: format === "esm" ? ".mjs" : ".cjs",
      };
    },
    dts: true,
    target: "es2022",
    external: ["consola", "ky", "nanoid", "zod", "react", "zustand"],
    splitting: false,
    sourcemap: true,
    clean: false,
    minify: true,
    minifySyntax: true,
    minifyWhitespace: true,
    treeshake: true,
    esbuildOptions(options) {
      options.alias = {
        "@/*": "./src/*",
      };
      options.drop = ["console", "debugger"];
      return options;
    },
  },

  // ---- Service ----
  {
    entry: {
      "service/index": "./src/service/index.ts",
    },
    format: ["esm", "cjs"],
    outExtension({ format }) {
      return {
        js: format === "esm" ? ".mjs" : ".cjs",
      };
    },
    dts: true,
    target: "es2022",
    external: ["consola", "ky", "nanoid", "zod"],
    splitting: false,
    sourcemap: true,
    clean: false,
    minify: true,
    minifySyntax: true,
    minifyWhitespace: true,
    treeshake: true,
    esbuildOptions(options) {
      options.alias = {
        "@/*": "./src/*",
      };
      options.drop = ["console", "debugger"];
      return options;
    },
  },

  // ---- Server SDK (Node.js with http2 support) ----
  {
    entry: {
      "server/index": "./src/server/index.ts",
      "server/adapter/next/index": "./src/server/adapter/next/index.ts",
    },
    format: ["esm", "cjs"],
    outExtension({ format }) {
      return {
        js: format === "esm" ? ".mjs" : ".cjs",
      };
    },
    dts: true,
    target: "node21",
    external: [
      // Dependencies
      "@hono/node-server",
      "@hono/zod-validator",
      "consola",
      "hono",
      "jose",
      "ky",
      "http2", // Explicitly externalize http2 for Node.js usage
      "nanoid",
      "zod",
      // Peer dependencies
      "typescript",
      "react",
      "zustand",
    ],
    splitting: false,
    sourcemap: true,
    clean: false,
    minify: true,
    minifySyntax: true,
    minifyWhitespace: true,
    treeshake: true,
    esbuildOptions(options) {
      options.alias = {
        "@/*": "./src/*",
      };
      options.drop = ["console", "debugger"];
      return options;
    },
  },
]);
