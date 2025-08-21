// Load .env early
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({
  path: path.resolve(__dirname, "../../.env.local"),
});

import { expect, test } from "vitest";
import { sign, verify } from "../lib/jwt";

test("sign() returns a valid JWT and verify() returns the correct payload with metadata", async () => {
  console.log(
    "[test] PRIVATE_KEY_JWK:",
    process.env.PRIVATE_KEY_JWK?.slice(0, 20) + "...",
  );

  const payload = { foo: "bar", n: 42 };
  const jwt = await sign(payload, process.env.PRIVATE_KEY_JWK!);

  // Check JWT format
  expect(jwt).toMatch(/^[^.]+\.[^.]+\.[^.]+$/);

  const verified = await verify(jwt, process.env.PUBLIC_KEY_JWK!);

  expect(verified).toMatchObject({
    foo: "bar",
    n: 42,
  });

  expect(verified).not.toBeNull();
  expect(typeof verified!.payload.iat).toBe("number");
  expect(typeof verified!.payload.exp).toBe("number");
});

test("verify() rejects JWT with tampered payload", async () => {
  const jwt = await sign({ role: "user" }, process.env.PRIVATE_KEY_JWK!);
  const [header, _payload, signature] = jwt.split(".");

  const evilPayload = Buffer.from(JSON.stringify({ role: "admin" })).toString(
    "base64url",
  );

  const tamperedJwt = [header, evilPayload, signature].join(".");

  await expect(
    verify(tamperedJwt, process.env.PUBLIC_KEY_JWK!),
  ).rejects.toThrow("signature verification failed");
});

test("verify() rejects JWT with tampered signature", async () => {
  const jwt = await sign(
    { email: "w0waeklf@v0id.me" },
    process.env.PRIVATE_KEY_JWK!,
  );
  const [header, payload, signature] = jwt.split(".");

  const fakeSignature = signature.split("").reverse().join("");
  const tamperedJwt = [header, payload, fakeSignature].join(".");

  await expect(
    verify(tamperedJwt, process.env.PUBLIC_KEY_JWK!),
  ).rejects.toThrow("signature verification failed");
});

test("verify() rejects malformed JWTs", async () => {
  const badJwt1 = "just.header.and.payload"; // no sig
  const badJwt2 = "a.b"; // not even 3 parts
  const badJwt3 = "a.b.c.d"; // too many parts

  await expect(verify(badJwt1, process.env.PUBLIC_KEY_JWK!)).rejects.toThrow();
  await expect(verify(badJwt2, process.env.PUBLIC_KEY_JWK!)).rejects.toThrow();
  await expect(verify(badJwt3, process.env.PUBLIC_KEY_JWK!)).rejects.toThrow();
});
