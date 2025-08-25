export async function generateHmac(
  payload: string,
  secret: string,
): Promise<string> {
  // Encode the secret and payload as Uint8Array
  const enc = new TextEncoder();
  const keyData = enc.encode(secret);
  const payloadData = enc.encode(payload);

  // Import the secret as a CryptoKey for HMAC
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: { name: "SHA-256" } },
    false,
    ["sign"],
  );

  // Sign the payload
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, payloadData);

  // Convert ArrayBuffer to hex string
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyHmac(
  payload: string,
  secret: string,
  hmac: string,
): Promise<boolean> {
  const generated = await generateHmac(payload, secret);
  return generated === hmac;
}
