// scripts/gen-eddsa-keys.ts
import { generateKeyPair, exportJWK } from "jose";

(async () => {
  // 1️⃣ make the keys extractable
  const { publicKey, privateKey } = await generateKeyPair("EdDSA", {
    extractable: true,
  });

  // --- OPTION A: .env one‑liners -----------------
  const pubEnv = JSON.stringify(await exportJWK(publicKey));
  const privEnv = JSON.stringify(await exportJWK(privateKey));

  console.log("\n# ---- .env entries ----");
  console.log(`PUBLIC_KEY_JWK='${pubEnv}'`);
  console.log(`PRIVATE_KEY_JWK='${privEnv}'`);
})();
