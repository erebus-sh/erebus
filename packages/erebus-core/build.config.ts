import { build } from "bun";

await build({
  entrypoints: ["src/index.ts"],
  outdir: "./dist",
  format: "esm",
  minify: true,
  external: ["ky", "jose"],
  sourcemap: true,
});
