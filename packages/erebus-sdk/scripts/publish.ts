#!/usr/bin/env bun

import { $ } from "bun";
import { parseArgs } from "util";
import { join } from "path";

try {
  console.log("🚀 Starting publish process...");
  const { values } = parseArgs({
    args: Bun.argv,
    options: {
      beta: {
        type: "boolean",
      },
    },
    strict: true,
    allowPositionals: true,
  });

  // Read package.json
  const packageJsonPath = join(import.meta.dir, "../package.json");
  const packageJson = await Bun.file(packageJsonPath).json();
  const currentVersion = packageJson.version;

  console.log(`📌 Current version: ${currentVersion}`);

  // Parse version (e.g., "0.0.179" or "0.0.179-beta.1")
  const versionMatch = currentVersion.match(
    /^(\d+)\.(\d+)\.(\d+)(?:-beta\.(\d+))?$/,
  );
  if (!versionMatch) {
    throw new Error(`Invalid version format: ${currentVersion}`);
  }

  const [, major, minor, patch, betaNum] = versionMatch;

  // Increment patch version
  const newPatch = parseInt(patch) + 1;
  let newVersion: string;

  if (values.beta) {
    // For beta: increment patch and add -beta.0 (or increment beta number if already beta)
    if (betaNum) {
      const newBetaNum = parseInt(betaNum) + 1;
      newVersion = `${major}.${minor}.${patch}-beta.${newBetaNum}`;
    } else {
      newVersion = `${major}.${minor}.${newPatch}-beta.0`;
    }
  } else {
    // For normal release: just increment patch
    newVersion = `${major}.${minor}.${newPatch}`;
  }

  console.log(`🔢 New version: ${newVersion}`);

  // Update package.json with new version
  packageJson.version = newVersion;
  await Bun.write(packageJsonPath, JSON.stringify(packageJson, null, 2) + "\n");
  console.log("✅ Version updated in package.json");

  // Run the build
  console.log("📦 Building package...");
  await $`bun run build`;
  console.log("✅ Build completed");

  // Confirm for latest tag
  if (!values.beta) {
    process.stdout.write(
      "⚠️ You are about to publish with the 'latest' tag. Are you sure? (y/N): ",
    );
    let input = "";
    for await (const line of console) {
      input = line.trim().toLowerCase();
      break;
    }
    if (input !== "y" && input !== "yes") {
      console.log("❌ Publish cancelled");
      process.exit(1);
    }
  }

  // Publish to npm
  const publishTag = values.beta ? "beta" : "latest";
  console.log(`📤 Publishing to npm (${publishTag})...`);
  await $`npm publish --tag ${publishTag}`;

  console.log("✅ Package published successfully!");
} catch (error) {
  console.error("❌ Publish failed:", error);
  process.exit(1);
}
