/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as analytics_query from "../analytics/query.js";
import type * as auth from "../auth.js";
import type * as console_mutation from "../console/mutation.js";
import type * as helper_action from "../helper/action.js";
import type * as http from "../http.js";
import type * as keys_mutation from "../keys/mutation.js";
import type * as keys_query from "../keys/query.js";
import type * as lib_guard from "../lib/guard.js";
import type * as lib_jwt from "../lib/jwt.js";
import type * as projects_mutation from "../projects/mutation.js";
import type * as projects_query from "../projects/query.js";
import type * as tables_api_keys from "../tables/api_keys.js";
import type * as tables_index from "../tables/index.js";
import type * as tables_projects from "../tables/projects.js";
import type * as tables_usage from "../tables/usage.js";
import type * as tables_user_profiles from "../tables/user_profiles.js";
import type * as usage_mutation from "../usage/mutation.js";
import type * as usage_query from "../usage/query.js";
import type * as user_profile_query from "../user_profile/query.js";
import type * as users_query from "../users/query.js";
import type * as utils_api_key from "../utils/api_key.js";
import type * as utils_shuffle from "../utils/shuffle.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  "analytics/query": typeof analytics_query;
  auth: typeof auth;
  "console/mutation": typeof console_mutation;
  "helper/action": typeof helper_action;
  http: typeof http;
  "keys/mutation": typeof keys_mutation;
  "keys/query": typeof keys_query;
  "lib/guard": typeof lib_guard;
  "lib/jwt": typeof lib_jwt;
  "projects/mutation": typeof projects_mutation;
  "projects/query": typeof projects_query;
  "tables/api_keys": typeof tables_api_keys;
  "tables/index": typeof tables_index;
  "tables/projects": typeof tables_projects;
  "tables/usage": typeof tables_usage;
  "tables/user_profiles": typeof tables_user_profiles;
  "usage/mutation": typeof usage_mutation;
  "usage/query": typeof usage_query;
  "user_profile/query": typeof user_profile_query;
  "users/query": typeof users_query;
  "utils/api_key": typeof utils_api_key;
  "utils/shuffle": typeof utils_shuffle;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
