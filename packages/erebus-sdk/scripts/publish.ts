#!/usr/bin/env bun

import { $ } from "bun";
import { parseArgs } from "util";

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

  if (values.beta) {
    console.log("🔰 Entering beta pre mode...");
    const res = await $`bunx changeset pre enter beta`.nothrow().quiet();
    if (res.exitCode === 0) {
      console.log("✅ Beta pre mode entered");
    } else {
      const msg = res.stderr.toString() + res.stdout.toString();
      if (msg.includes("cannot be run when in pre mode")) {
        console.log("ℹ️ Already in pre mode, skipping enter");
      } else {
        console.error("⚠️ Failed to enter pre mode:", msg);
        process.exit(1);
      }
    }
  } else {
    console.log("🔰 Exiting pre mode for normal release...");
    const res = await $`bunx changeset pre exit`.nothrow().quiet();
    if (res.exitCode === 0) {
      console.log("✅ Exited pre mode");
    } else {
      const msg = res.stderr.toString() + res.stdout.toString();
      if (msg.includes("can only be run when")) {
        console.log("ℹ️ Not in pre mode, skipping exit");
      } else {
        console.error("⚠️ Failed to exit pre mode:", msg);
        process.exit(1);
      }
    }
  }

  // Step 1: Run the build
  console.log("📦 Building package...");
  await $`bun run build`;
  console.log("✅ Build completed");

  // Step 2: Versioning with changeset
  console.log("🔢 Running changeset version...");
  await $`bunx changeset version`;
  console.log("✅ Version updated using changeset");

  // Step 3: Publish to npm
  const publishArgs = ["changeset", "publish"];
  if (values.beta) {
    publishArgs.push("--tag", "beta");
  }

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

  console.log(`📤 Publishing to npm ${values.beta ? "(beta)" : "(latest)"}...`);
  await $`bunx ${publishArgs}`;

  console.log("✅ Package published successfully!");
} catch (error) {
  console.error("❌ Publish failed:", error);
  process.exit(1);
}
