import { build } from "bun";
import fg from "fast-glob";
const files = await fg("src/**/*.{ts,tsx}");

await build({
  entrypoints: [...files],
  outdir: "./dist",
  format: "esm",
  minify: true,
  sourcemap: true,
  external: ["*"],
});
