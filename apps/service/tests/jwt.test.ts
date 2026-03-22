import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import { verifyRequestToken } from "@/lib/grants_jwt";

describe("JWT", () => {
  it("should verify a valid grant token", async () => {
    // Generate a fresh Ed25519 key pair for testing
    const keyPair = await crypto.subtle.generateKey("Ed25519", true, [
      "sign",
      "verify",
    ]);

    // Create a JWT payload with far-future expiry
    const header = { alg: "EdDSA" };
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      project_id: "test_project",
      channel: "test",
      topics: [{ topic: "test", scope: "read" }],
      userId: "test",
      issuedAt: now,
      expiresAt: now + 3600,
      iat: now,
      exp: now + 3600,
    };

    // Encode header and payload
    const encode = (obj: unknown) =>
      btoa(JSON.stringify(obj))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

    const headerB64 = encode(header);
    const payloadB64 = encode(payload);
    const signingInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`);

    // Sign with the private key
    const signature = await crypto.subtle.sign(
      "Ed25519",
      keyPair.privateKey,
      signingInput,
    );

    const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const token = `${headerB64}.${payloadB64}.${signatureB64}`;

    // Export the public key as JWK
    const publicKeyJwk = await crypto.subtle.exportKey(
      "jwk",
      keyPair.publicKey,
    );

    // Verify the token using the service's verifyRequestToken function
    const result = await verifyRequestToken(
      token,
      JSON.stringify(publicKeyJwk),
    );
    expect(result).not.toBeNull();
    expect(result?.payload?.channel).toBe("test");
    expect(result?.payload?.project_id).toBe("test_project");
  });
});
