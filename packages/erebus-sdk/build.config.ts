import fg from "fast-glob";
import { readFileSync } from "fs";

// Read dependencies and peerDependencies from package.json to mark as external
const pkg = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
);
const externalDeps = [
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.peerDependencies || {}),
];

// Find all TypeScript and TSX files in src, but exclude test and story files
const files = await fg([
  "src/**/*.{ts,tsx}",
  "!src/**/*.test.{ts,tsx}",
  "!src/**/*.spec.{ts,tsx}",
  "!src/**/*.stories.{ts,tsx}",
]);

// Separate browser/client, node/server, and service entrypoints for optimal output
const clientFiles = files.filter((f) => f.includes("client/"));
const serviceFiles = files.filter((f) => f.includes("service/"));
const serverFiles = files.filter(
  (f) => !f.includes("client/") && !f.includes("service/"),
);

// Build for browser (client code)
const clientBuild = await Bun.build({
  entrypoints: clientFiles,
  outdir: "./dist/client",
  format: "esm",
  target: "browser",
  minify: {
    syntax: true,
    whitespace: true,
    identifiers: true,
  },
  sourcemap: "linked",
  external: externalDeps,
  packages: "external",
  banner: "// Erebus SDK Client - Built with Bun",
});

// Build for node (service code)
const serviceBuild = await Bun.build({
  entrypoints: serviceFiles,
  outdir: "./dist/service",
  format: "esm",
  target: "node",
  minify: {
    syntax: true,
    whitespace: true,
    identifiers: true,
  },
  sourcemap: "linked",
  external: externalDeps,
  packages: "external",
  banner: "// Erebus SDK Service - Built with Bun",
});

// Build for node (server code)
const serverBuild = await Bun.build({
  entrypoints: serverFiles,
  outdir: "./dist/server",
  format: "esm",
  target: "node",
  minify: {
    syntax: true,
    whitespace: true,
    identifiers: true,
  },
  sourcemap: "linked",
  external: externalDeps,
  packages: "external",
  banner: "// Erebus SDK Server - Built with Bun",
});

// Handle build errors
for (const build of [clientBuild, serviceBuild, serverBuild]) {
  if (!build.success) {
    console.error("Build failed:");
    for (const log of build.logs) {
      console.error(log);
    }
    process.exit(1);
  }
}
