export const monoNow = (): number => {
  // Cloudflare Workers / Web APIs - this is what we actually want
  if (typeof performance !== "undefined" && performance.now) {
    return performance.now();
  }

  // Fallback only for edge cases (shouldn't happen in Workers)
  return Date.now();
};
