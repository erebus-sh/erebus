import { build } from "bun";
import fg from "fast-glob";
const files = await fg("src/client/react/**/*.{ts,tsx}");

await build({
  entrypoints: [...files],
  outdir: "./dist",
  format: "esm",
  minify: true,
  sourcemap: true,
  external: ["*"],
});
