#!/usr/bin/env bun

import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";

console.log("🚀 Starting publish process...");

try {
  // Step 1: Run the build
  console.log("📦 Building package...");
  execSync("bun run build", { stdio: "inherit" });
  console.log("✅ Build completed");

  // Step 2: Auto-bump patch version
  console.log("🔢 Bumping patch version...");
  const packageJson = JSON.parse(readFileSync("package.json", "utf-8"));
  const versionParts = packageJson.version.split(".");
  const newPatchVersion = parseInt(versionParts[2]) + 1;
  const newVersion = `${versionParts[0]}.${versionParts[1]}.${newPatchVersion}`;
  packageJson.version = newVersion;
  writeFileSync("package.json", JSON.stringify(packageJson, null, 2) + "\n");
  console.log(
    `✅ Version bumped from ${versionParts.join(".")} to ${newVersion}`,
  );

  // Step 3: Publish to npm
  console.log("📤 Publishing to npm...");
  execSync("bun publish --access public", { stdio: "inherit" });
  console.log("✅ Package published successfully!");
} catch (error) {
  console.error("❌ Publish failed:", error);
  process.exit(1);
}
