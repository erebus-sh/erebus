import { SignJWT, importJWK } from "jose";

/**
 * Static Ed25519 test key pair (deterministic, not random).
 * The public key JWK is also set in vitest.config.ts as the PUBLIC_KEY_JWK binding.
 */
export const TEST_PUBLIC_KEY_JWK = {
  crv: "Ed25519",
  kty: "OKP",
  x: "3OYFTPVBTnxu58THGxT_GTpYhXC2SzMOeihTi1esMdE",
} as const;

export const TEST_PRIVATE_KEY_JWK = {
  crv: "Ed25519",
  d: "9b5vMVlzCEg_p-VjX_noI9YcyS2XIPncoW-I6VDENHs",
  kty: "OKP",
  x: "3OYFTPVBTnxu58THGxT_GTpYhXC2SzMOeihTi1esMdE",
} as const;

/**
 * Stringified public key JWK, matching what the worker expects in env.PUBLIC_KEY_JWK.
 */
export const TEST_PUBLIC_KEY_JWK_STRING = JSON.stringify(TEST_PUBLIC_KEY_JWK);

/**
 * Creates a signed JWT grant token for tests.
 */
export async function createTestToken(
  claims: {
    project_id: string;
    channel: string;
    topics: { topic: string; scope: string }[];
    userId: string;
    key_id?: string;
    webhook_url?: string;
  },
  overrides?: { expiresInSeconds?: number },
): Promise<string> {
  const privateKey = await importJWK(TEST_PRIVATE_KEY_JWK, "EdDSA");
  const expiresIn = overrides?.expiresInSeconds ?? 7200; // 2 hours default
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({
    ...claims,
    issuedAt: now,
    expiresAt: now + expiresIn,
  })
    .setProtectedHeader({ alg: "EdDSA" })
    .setIssuedAt(now)
    .setExpirationTime(now + expiresIn)
    .sign(privateKey);
}
