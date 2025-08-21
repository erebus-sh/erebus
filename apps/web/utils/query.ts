"use client";

import { makeUseQueryWithStatus } from "convex-helpers/react";
import { useQueries } from "convex/react";
import { useQueries as useQueriesCache } from "convex-helpers/react/cache";

export const useQueryWithState = makeUseQueryWithStatus(useQueries);
export const useQueryWithStateCache = makeUseQueryWithStatus(useQueriesCache);
