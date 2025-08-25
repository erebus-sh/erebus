import { v } from "convex/values";
import { query } from "../_generated/server";
import { Doc } from "../_generated/dataModel";
import {
  getValidatedActiveKeyForQuery,
  getValidatedProjectBySlugWithOwnershipForQuery,
} from "../lib/guard";

export const getProjectIdByKey = query({
  args: {
    secret_key: v.string(),
  },
  handler: async (ctx, args) => {
    const { secret_key } = args;
    const key = await getValidatedActiveKeyForQuery(ctx, secret_key);
    return key.projectId;
  },
});

export const getKeyByProjectSlug = query({
  args: {
    projectSlug: v.string(),
  },
  handler: async (ctx, args): Promise<Doc<"api_keys">[]> => {
    const { projectSlug } = args;
    const { user, project } =
      await getValidatedProjectBySlugWithOwnershipForQuery(ctx, projectSlug);
    const keys = await ctx.db
      .query("api_keys")
      .withIndex("by_projectId", (q) => q.eq("projectId", project._id))
      .order("desc")
      .collect();
    return keys;
  },
});

export const getKeyIdByKey = query({
  args: {
    secret_key: v.string(),
  },
  handler: async (ctx, args): Promise<string> => {
    const { secret_key } = args;
    const key = await getValidatedActiveKeyForQuery(ctx, secret_key);
    return key._id;
  },
});
