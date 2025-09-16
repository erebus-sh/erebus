#!/usr/bin/env bun

/**
 * Simple test to verify logger functionality in different environments
 *
 * Usage:
 * NODE_ENV=development bun scripts/test-logger.ts  # Should show logs
 * NODE_ENV=production bun scripts/test-logger.ts   # Should be silent
 */

// Import the logger using the same path as the SDK
// Note: In a real scenario, this would be built and imported from dist/
import { logger } from "../src/internal/logger/consola.ts";

const nodeEnv: string | undefined = process.env.NODE_ENV;

console.log(`\n🧪 Testing logger in ${nodeEnv || "development"} mode...\n`);

// Test all logger methods
logger.info("This is an info message", { test: "data" });
logger.warn("This is a warning message", { test: "data" });
logger.error("This is an error message", { test: "data" });
logger.debug("This is a debug message", { test: "data" });
logger.success("This is a success message", { test: "data" });

console.log("\n✅ Logger test completed\n");

if (nodeEnv === "production") {
  console.log(
    "📝 Note: In production mode, you should not see any Erebus log messages above",
  );
} else {
  console.log(
    "📝 Note: In development mode, you should see Erebus log messages above",
  );
}
