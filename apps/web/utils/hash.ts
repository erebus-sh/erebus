/**
 * Computes a SHA-256 hash of the input string and returns it as a hex string.
 * Works in both Node.js (>= v15) and modern browsers.
 */
export async function sha256(data: string): Promise<string> {
  let buffer: ArrayBuffer;
  if (typeof window !== "undefined" && window.crypto?.subtle) {
    // Browser environment
    buffer = await window.crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(data),
    );
  } else if (typeof crypto !== "undefined" && crypto.subtle) {
    // Edge runtimes (e.g. Cloudflare Workers)
    buffer = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(data),
    );
  } else {
    // Node.js environment
    // Use the built-in 'crypto' module
    const { createHash } = await import("crypto");
    return createHash("sha256").update(data).digest("hex");
  }

  // Convert ArrayBuffer to hex string
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
