#!/usr/bin/env bun

import { execSync } from "child_process";
import { consola } from "consola";
import chalk from "chalk";
import { readFileSync, existsSync, copyFileSync, writeFileSync } from "fs";
import { join } from "path";

interface PublishOptions {
  dryRun?: boolean;
  verbose?: boolean;
  skipBuild?: boolean;
}

class ErebusPublisher {
  private startTime: number;
  private options: PublishOptions;

  constructor(options: PublishOptions = {}) {
    this.options = options;
    this.startTime = Date.now();
  }

  private log(
    message: string,
    type: "info" | "success" | "error" | "warn" = "info",
  ) {
    const timestamp = new Date().toLocaleTimeString();
    const coloredTimestamp = chalk.dim(`[${timestamp}]`);

    switch (type) {
      case "success":
        consola.success(`${coloredTimestamp} ${message}`);
        break;
      case "error":
        consola.error(`${coloredTimestamp} ${message}`);
        break;
      case "warn":
        consola.warn(`${coloredTimestamp} ${message}`);
        break;
      default:
        consola.info(`${coloredTimestamp} ${message}`);
    }
  }

  private showBanner() {
    console.log(chalk.magenta.bold("\n🚀 EREBUS SDK PUBLISHER"));
    console.log(chalk.cyan("   Publishing Tool\n"));
  }

  private async checkPrerequisites(): Promise<void> {
    this.log("🔍 Checking prerequisites...", "info");

    // Check if package.json exists
    const packageJsonPath = join(process.cwd(), "package.json");
    if (!existsSync(packageJsonPath)) {
      throw new Error("package.json not found in current directory");
    }

    // Read and validate package.json
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    this.log(
      `📋 Package: ${chalk.bold(packageJson.name)}@${chalk.bold(packageJson.version)}`,
      "success",
    );

    // Check if bun is available
    try {
      execSync("bun --version", { stdio: "pipe" });
      this.log("🐰 Bun runtime: Available", "success");
    } catch {
      throw new Error("Bun is not installed or not in PATH");
    }

    // Check if npm is configured
    try {
      const npmUser = execSync("npm whoami", {
        stdio: "pipe",
        encoding: "utf-8",
      }).trim();
      this.log(`👤 NPM user: ${chalk.bold(npmUser)}`, "success");
    } catch {
      throw new Error('NPM is not authenticated. Please run "npm login" first');
    }
  }

  private async buildPackage(): Promise<void> {
    if (this.options.skipBuild) {
      this.log("⏭️  Skipping build step...", "warn");
      return;
    }

    this.log("🔨 Building package...", "info");
    const buildStart = Date.now();

    try {
      execSync("bun run build:sdk", {
        stdio: this.options.verbose ? "inherit" : "pipe",
      });
      const buildTime = ((Date.now() - buildStart) / 1000).toFixed(2);
      this.log(`✅ Build completed in ${chalk.bold(buildTime)}s`, "success");
    } catch (error) {
      this.log("❌ Build failed", "error");
      throw error;
    }
  }

  private incrementVersion(packageJson: any): string {
    const currentVersion = packageJson.version;

    // Increment patch version (e.g., 0.0.1 -> 0.0.2)
    const versionParts = currentVersion.split(".");
    const newPatchVersion = parseInt(versionParts[2]) + 1;
    const newVersion = `${versionParts[0]}.${versionParts[1]}.${newPatchVersion}`;

    return newVersion;
  }

  private async copyEssentialFiles(): Promise<void> {
    this.log("📋 Copying essential files to dist...", "info");

    const distPath = join(process.cwd(), "dist");
    const essentialFiles = [
      { src: "package.json", dest: "package.json" },
      { src: "README.md", dest: "README.md" },
      { src: "LICENSE.md", dest: "LICENSE.md" },
    ];

    for (const file of essentialFiles) {
      const srcPath = join(process.cwd(), file.src);
      const destPath = join(distPath, file.dest);

      try {
        if (existsSync(srcPath)) {
          if (file.src === "package.json") {
            // Modify package.json for publishing
            const packageJson = JSON.parse(readFileSync(srcPath, "utf-8"));
            const currentVersion = packageJson.version;

            // Increment version
            const newVersion = this.incrementVersion(packageJson);
            packageJson.version = newVersion;

            // Update root package.json with new version
            const rootPackageJsonPath = join(process.cwd(), "package.json");
            const rootPackageJson = JSON.parse(
              readFileSync(rootPackageJsonPath, "utf-8"),
            );
            rootPackageJson.version = newVersion;
            writeFileSync(
              rootPackageJsonPath,
              JSON.stringify(rootPackageJson, null, 2),
            );

            // Remove scripts that won't work in dist directory
            delete packageJson.scripts;
            delete packageJson.devDependencies;
            // Explicitly include all necessary files and directories
            packageJson.files = [
              "client",
              "server",
              "service",
              "types",
              "package.json",
              "README.md",
              "LICENSE.md",
            ];

            // Fix exports paths to be relative to dist directory
            if (packageJson.exports) {
              const updateExports = (exports: any) => {
                if (typeof exports === "object") {
                  for (const key in exports) {
                    if (typeof exports[key] === "object") {
                      updateExports(exports[key]);
                    } else if (
                      typeof exports[key] === "string" &&
                      exports[key].startsWith("./dist/")
                    ) {
                      // Remove the ./dist/ prefix since we're in dist directory
                      exports[key] = exports[key].replace("./dist/", "./");
                    }
                  }
                }
              };
              updateExports(packageJson.exports);
            }

            // Ensure root entry fields are relative to dist/ after copy
            // We publish from dist/, so these should point to built artifacts within dist
            packageJson.main = "./index.cjs";
            packageJson.module = "./index.mjs";
            packageJson.types = "./index.d.ts";

            // Remove stale values if present in copied file
            if (packageJson.module === "index.ts") delete packageJson.module;
            if (packageJson.main === "index.js") delete packageJson.main;

            // Write the modified package.json to dist
            writeFileSync(destPath, JSON.stringify(packageJson, null, 2));

            this.log(
              `📦 Version incremented: ${chalk.bold(currentVersion)} → ${chalk.bold(newVersion)}`,
              "success",
            );
          } else {
            copyFileSync(srcPath, destPath);
          }
          this.log(`📄 Copied ${file.src} to dist/`, "success");
        } else {
          this.log(`⚠️  ${file.src} not found in root directory`, "warn");
        }
      } catch (error) {
        this.log(`❌ Failed to copy ${file.src}: ${error}`, "error");
        throw error;
      }
    }
  }

  private async validateBuild(): Promise<void> {
    this.log("🔍 Validating build output...", "info");

    const distPath = join(process.cwd(), "dist");
    if (!existsSync(distPath)) {
      throw new Error("dist directory not found. Build may have failed.");
    }

    // Check for essential files
    const essentialFiles = ["package.json", "README.md", "LICENSE.md"];
    for (const file of essentialFiles) {
      const filePath = join(distPath, file);
      if (existsSync(filePath)) {
        this.log(`📄 ${file}: ${chalk.green("Present")}`, "success");
      } else {
        this.log(`📄 ${file}: ${chalk.red("Missing")}`, "warn");
      }
    }

    // Validate representative build artifacts exist
    const artifacts = [
      "index.js",
      "index.d.ts",
      "client/core/Erebus.js",
      "client/react/index.js",
      "server/app.js",
      "service/Service.js",
    ];
    for (const p of artifacts) {
      const fp = join(distPath, p);
      if (!existsSync(fp)) {
        throw new Error(`Missing build artifact: ${p}`);
      }
    }
  }

  private async publishPackage(): Promise<void> {
    if (this.options.dryRun) {
      this.log("🧪 Dry run mode - skipping actual publish", "warn");
      return;
    }

    this.log("📤 Publishing to NPM registry...", "info");
    const publishStart = Date.now();

    try {
      const distPath = join(process.cwd(), "dist");
      const publishCommand = "bun publish --access public";
      if (this.options.verbose) {
        this.log(
          `Running: ${chalk.dim(`cd ${distPath} && ${publishCommand}`)}`,
          "info",
        );
      }

      // Change to dist directory and publish from there
      execSync(publishCommand, {
        stdio: this.options.verbose ? "inherit" : "pipe",
        cwd: distPath,
      });
      const publishTime = ((Date.now() - publishStart) / 1000).toFixed(2);
      this.log(
        `🚀 Package published successfully in ${chalk.bold(publishTime)}s!`,
        "success",
      );
    } catch (error: any) {
      if (
        error.stdout?.includes(
          "You cannot publish over the previously published versions",
        )
      ) {
        this.log("⚠️  Version already exists on registry", "warn");
      } else {
        this.log("❌ Publish failed", "error");
        throw error;
      }
    }
  }

  private showSummary(): void {
    const totalTime = ((Date.now() - this.startTime) / 1000).toFixed(2);

    console.log(chalk.magenta.bold("\n📊 PUBLISH SUMMARY"));
    console.log(chalk.green("✅ Prerequisites check passed"));
    console.log("✅ Version incremented");
    console.log(
      this.options.skipBuild
        ? "⏭️  Build step skipped"
        : "✅ Package built successfully",
    );
    console.log("✅ Essential files copied to dist/");
    console.log("✅ Build validation completed");
    console.log(
      this.options.dryRun
        ? "🧪 Dry run completed"
        : "🚀 Package published to registry",
    );
    console.log(chalk.bold(`⏱️  Total time: ${totalTime}s\n`));
  }

  public async publish(): Promise<void> {
    try {
      this.showBanner();
      this.log(
        `🚀 ${chalk.bold("Starting Erebus SDK publish process...")}`,
        "info",
      );

      if (this.options.dryRun) {
        this.log("🧪 Running in dry-run mode", "warn");
      }
      if (this.options.verbose) {
        this.log("📝 Verbose mode enabled", "info");
      }

      await this.checkPrerequisites();
      await this.buildPackage();
      await this.copyEssentialFiles();
      await this.validateBuild();
      await this.publishPackage();

      this.showSummary();
      this.log(
        `🎉 ${chalk.bold.green("All done!")} Your package is now available on NPM.`,
        "success",
      );
    } catch (error: any) {
      const errorMessage = error.message || "Unknown error occurred";
      this.log(
        `💥 ${chalk.bold.red("Publish process failed:")} ${errorMessage}`,
        "error",
      );

      if (this.options.verbose && error.stack) {
        console.log("\n" + chalk.dim(error.stack));
      }

      process.exit(1);
    }
  }
}

// Parse command line arguments
function parseArgs(): PublishOptions {
  const args = process.argv.slice(2);
  const options: PublishOptions = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--dry-run":
      case "-d":
        options.dryRun = true;
        break;
      case "--verbose":
      case "-v":
        options.verbose = true;
        break;
      case "--skip-build":
      case "-s":
        options.skipBuild = true;
        break;
      case "--help":
      case "-h":
        console.log(`
${chalk.bold("Erebus SDK Publisher")}
${chalk.cyan("A professional CLI tool for publishing the Erebus SDK to NPM")}

${chalk.bold("Usage:")}
  bun run publish [options]

${chalk.bold("Options:")}
  -d, --dry-run     Run in dry-run mode (skip actual publish)
  -v, --verbose      Enable verbose output
  -s, --skip-build   Skip the build step
  -h, --help         Show this help message

${chalk.bold("Examples:")}
  bun run publish                    # Normal publish (uses build:sdk)
  bun run publish --dry-run          # Test without publishing
  bun run publish --verbose          # Detailed output
  bun run publish --skip-build       # Skip build step
`);
        process.exit(0);
        break;
      default:
        consola.error(`Unknown option: ${args[i]}`);
        consola.info("Use --help to see available options");
        process.exit(1);
    }
  }

  return options;
}

// Run the publish function
async function main() {
  const options = parseArgs();
  const publisher = new ErebusPublisher(options);
  await publisher.publish();
}

main().catch((error) => {
  consola.error("Unexpected error:", error);
  process.exit(1);
});
