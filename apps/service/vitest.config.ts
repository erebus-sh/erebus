import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";
import path from "path";

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          bindings: {
            EREBUS_ON_HOLD: "false",
            PUBLIC_KEY_JWK: JSON.stringify({
              crv: "Ed25519",
              kty: "OKP",
              x: "3OYFTPVBTnxu58THGxT_GTpYhXC2SzMOeihTi1esMdE",
            }),
          },
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
