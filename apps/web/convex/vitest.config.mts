import { defineConfig } from "vitest/config";

import { config } from 'dotenv';
import path from "path";

// TODO: This does not work at all, it won't load the env file, i hate the javascript ecosystem so much...
const env = config({ path: path.resolve(process.cwd(), 'apps/web/.env') });
console.log("env:", env.parsed);
export default defineConfig({
  test: {
    environment: "edge-runtime",
    server: { deps: { inline: ["convex-test"] } },
    env: env.parsed
  },
});
