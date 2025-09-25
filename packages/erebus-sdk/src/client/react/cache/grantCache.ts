const GRANT_CACHE_KEY = "___erebus:g";
const GRANT_CACHE_TIMESTAMP_KEY = `${GRANT_CACHE_KEY}:ts`;
const GRANT_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

export const getGrant = (): string | undefined => {
  if (typeof localStorage !== "undefined") {
    const grant = localStorage.getItem(GRANT_CACHE_KEY);
    const tsRaw = localStorage.getItem(GRANT_CACHE_TIMESTAMP_KEY);
    if (!grant || !tsRaw) {
      console.log(
        "[localStorage] getGrant: No grant or timestamp found in cache.",
      );
      return undefined;
    }
    const ts = Number(tsRaw);
    if (isNaN(ts)) {
      console.warn(
        "[localStorage] getGrant: Timestamp is invalid, clearing grant.",
      );
      clearGrant();
      return undefined;
    }
    const now = Date.now();
    if (now - ts > GRANT_CACHE_TTL_MS) {
      console.log("[localStorage] getGrant: Grant expired, clearing grant.");
      clearGrant();
      return undefined;
    }
    console.log("[localStorage] getGrant: Grant found and valid.");
    return grant;
  }
  console.warn("[localStorage] getGrant: localStorage is not available.");
  return undefined;
};

export const setGrant = (grant: string): void => {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(GRANT_CACHE_KEY, grant);
    localStorage.setItem(GRANT_CACHE_TIMESTAMP_KEY, Date.now().toString());
    console.log("[localStorage] setGrant: Grant and timestamp set in cache.");
  } else {
    console.warn("[localStorage] setGrant: localStorage is not available.");
  }
};

const clearGrant = (): void => {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(GRANT_CACHE_KEY);
    localStorage.removeItem(GRANT_CACHE_TIMESTAMP_KEY);
    console.log(
      "[localStorage] clearGrant: Grant and timestamp removed from cache.",
    );
  } else {
    console.warn("[localStorage] clearGrant: localStorage is not available.");
  }
};
