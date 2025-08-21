export function validateWebSocketUrl(raw?: string): boolean {
  if (!raw) {
    return false;
  }

  try {
    const url = new URL(raw);
    if (url.protocol !== "ws:" && url.protocol !== "wss:") {
      return false;
    }
    // Ensure wss is used on non-localhost URLs
    if (!url.hostname.includes("localhost") && url.protocol === "ws:") {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
