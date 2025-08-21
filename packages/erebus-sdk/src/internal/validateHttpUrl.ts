export function validateHttpUrl(raw?: string): URL {
  if (!raw) {
    throw new Error(
      "Missing Erebus webhook URL. Set it in _options or as NEXT_PUBLIC_EREBUS_GRANT_WEBHOOK_URL env.",
    );
  }

  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error(
        "Invalid webhook protocol. URL must start with http:// or https://",
      );
    }
    return url;
  } catch {
    throw new Error(
      "Erebus grant webhook URL is invalid. Provide a valid http:// or https:// URL.",
    );
  }
}
