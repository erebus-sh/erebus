"use client";

import { useRouter } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";

/**
 * Utility for safely handling ?next=... redirects.
 * Returns a boolean `hasNext` indicating if a valid next param exists.
 */
export function useNextRedirect(defaultPath = "/") {
  const router = useRouter();

  // nuqs handles query param <-> state
  const [rawNext, setNext] = useQueryState(
    "next",
    parseAsString.withDefault(defaultPath),
  );

  // Validate to prevent open redirect
  const isValidNext = rawNext && rawNext.startsWith("/");
  const safeNext = isValidNext ? rawNext : defaultPath;
  const hasNext = Boolean(isValidNext);

  function redirectNow() {
    router.push(safeNext);
  }

  return {
    next: safeNext,
    hasNext,
    setNext, // set manually if needed
    clearNext: () => setNext(null), // cleanup after use
    redirectNow, // push immediately
  };
}
