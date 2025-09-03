export const GRANT_CACHE_KEY = "erebus:grant";

export const getGrant = () => {
  if (typeof localStorage !== "undefined") {
    return localStorage.getItem(GRANT_CACHE_KEY);
  }
  return undefined;
};

export const setGrant = (grant: string) => {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(GRANT_CACHE_KEY, grant);
  }
};

export const clearGrant = () => {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(GRANT_CACHE_KEY);
  }
};
