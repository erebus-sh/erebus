#!/usr/bin/env bun

import { execSync } from "child_process";

console.log("🚀 Starting publish process...");

try {
  // Step 1: Run the build
  console.log("📦 Building package...");
  execSync("bun run build", { stdio: "inherit" });
  console.log("✅ Build completed");

  // Step 2: Versioning with changeset
  console.log("🔢 Running changeset version...");
  execSync("bunx changeset version", { stdio: "inherit" });
  console.log("✅ Version updated using changeset");

  // Step 3: Publish to npm
  const tag = process.argv.includes("--beta") ? "--tag beta" : "";
  console.log(`📤 Publishing to npm ${tag || "(latest)"}...`);
  execSync(`bunx changeset publish ${tag}`, { stdio: "inherit" });

  console.log("✅ Package published successfully!");
} catch (error) {
  console.error("❌ Publish failed:", error);
  process.exit(1);
}
