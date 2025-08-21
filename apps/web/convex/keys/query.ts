import { ConvexError, v } from "convex/values";
import { query } from "../_generated/server";
import { api } from "../_generated/api";
import { Doc } from "../_generated/dataModel";

export const getProjectIdByKey = query({
  args: {
    secret_key: v.string(),
  },
  handler: async (ctx, args) => {
    const { secret_key } = args;
    const key = await ctx.db
      .query("api_keys")
      .withIndex("by_secret_key", (q) => q.eq("key", secret_key))
      .first();
    if (!key) {
      throw new ConvexError(
        "API key not found. Please check that you have provided a valid secret key.",
      );
    }
    if (key.status === "disabled") {
      throw new ConvexError(
        "API key is disabled. Please contact your administrator or generate a new key.",
      );
    }
    if (key.status === "revoked") {
      throw new ConvexError(
        "API key has been revoked. This key can no longer be used. Please use a valid, active key.",
      );
    }
    if (key.revokedAt) {
      throw new ConvexError(
        "API key is invalid: this key was revoked at " +
          new Date(key.revokedAt).toLocaleString() +
          ". Please use a valid, active key.",
      );
    }

    return key.projectId;
  },
});

export const getKeyByProjectSlug = query({
  args: {
    projectSlug: v.string(),
  },
  handler: async (ctx, args): Promise<Doc<"api_keys">[]> => {
    const { projectSlug } = args;
    const project = await ctx.runQuery(api.projects.query.getProjectBySlug, {
      slug: projectSlug,
    });
    if (!project) {
      throw new ConvexError("Project not found");
    }
    const keys = await ctx.db
      .query("api_keys")
      .withIndex("by_projectId", (q) => q.eq("projectId", project._id))
      .collect();
    return keys;
  },
});
