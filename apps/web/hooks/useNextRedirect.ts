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
  // Important: do NOT use a default here so we can detect absence of ?next
  const [rawNext, setNext] = useQueryState("next", parseAsString);

  // Validate to prevent open redirect and detect actual presence of ?next
  const nextExists = typeof rawNext === "string" && rawNext.length > 0;
  const isValidNext = nextExists && rawNext.startsWith("/");
  const safeNext = isValidNext ? rawNext : defaultPath;
  const hasNext = Boolean(nextExists && isValidNext);

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
