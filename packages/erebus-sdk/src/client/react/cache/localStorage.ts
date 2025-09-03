export const GRANT_CACHE_KEY = "___erebus:g";
export const GRANT_CACHE_TIMESTAMP_KEY = `${GRANT_CACHE_KEY}:ts`;
const GRANT_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

export const getGrant = (): string | undefined => {
  if (typeof localStorage !== "undefined") {
    const grant = localStorage.getItem(GRANT_CACHE_KEY);
    const tsRaw = localStorage.getItem(GRANT_CACHE_TIMESTAMP_KEY);
    if (!grant || !tsRaw) return undefined;
    const ts = Number(tsRaw);
    if (isNaN(ts)) {
      clearGrant();
      return undefined;
    }
    const now = Date.now();
    if (now - ts > GRANT_CACHE_TTL_MS) {
      clearGrant();
      return undefined;
    }
    return grant;
  }
  return undefined;
};

export const setGrant = (grant: string): void => {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(GRANT_CACHE_KEY, grant);
    localStorage.setItem(GRANT_CACHE_TIMESTAMP_KEY, Date.now().toString());
  }
};

export const clearGrant = (): void => {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(GRANT_CACHE_KEY);
    localStorage.removeItem(GRANT_CACHE_TIMESTAMP_KEY);
  }
};
