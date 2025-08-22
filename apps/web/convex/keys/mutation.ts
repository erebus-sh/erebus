import { api } from "../_generated/api";
import { mutation } from "../_generated/server";
import { ConvexError, v } from "convex/values";
import { generateApiKey } from "../utils/api_key";
import { Id } from "../_generated/dataModel";

export const createKey = mutation({
  args: {
    title: v.string(),
    projectSlug: v.string(),
    dev: v.boolean(),
  },
  handler: async (ctx, args): Promise<string> => {
    const user = await ctx.runQuery(api.users.query.getMe);
    if (!user) {
      throw new Error("User not found");
    }

    // Get the projectId from the projectSlug
    const project = await ctx.runQuery(api.projects.query.getProjectBySlug, {
      slug: args.projectSlug,
    });
    if (!project) throw new ConvexError("Project not found");

    // Generate key
    const api_key = generateApiKey(args.dev);

    await ctx.db.insert("api_keys", {
      label: args.title,
      projectId: project._id,
      createdBy: user._id as Id<"users">,
      key: api_key,
      createdAt: Date.now(),
      status: "active",
    });

    return api_key;
  },
});

export const revokeKey = mutation({
  args: {
    keyId: v.id("api_keys"),
    projectSlug: v.string(),
  },
  handler: async (ctx, args): Promise<boolean> => {
    const user = await ctx.runQuery(api.users.query.getMe);
    if (!user) {
      throw new Error("User not found");
    }

    const project = await ctx.runQuery(api.projects.query.getProjectBySlug, {
      slug: args.projectSlug,
    });
    if (!project) throw new ConvexError("Project not found");

    const key = await ctx.db.get(args.keyId);
    if (!key) throw new ConvexError("Key not found");

    if (key.projectId !== project._id)
      throw new ConvexError("Key does not belong to this project");

    if (key.createdBy !== user._id)
      throw new ConvexError("You are not authorized to revoke this key");

    await ctx.db.patch(args.keyId, { status: "revoked" });
    return true;
  },
});

export const updateKey = mutation({
  args: {
    keyId: v.id("api_keys"),
    projectSlug: v.string(),
    title: v.string(),
  },
  handler: async (ctx, args): Promise<boolean> => {
    const user = await ctx.runQuery(api.users.query.getMe);
    if (!user) {
      throw new Error("User not found");
    }

    const project = await ctx.runQuery(api.projects.query.getProjectBySlug, {
      slug: args.projectSlug,
    });
    if (!project) throw new ConvexError("Project not found");

    const key = await ctx.db.get(args.keyId);
    if (!key) throw new ConvexError("Key not found");

    if (key.projectId !== project._id)
      throw new ConvexError("Key does not belong to this project");

    if (key.createdBy !== user._id)
      throw new ConvexError("You are not authorized to update this key");

    await ctx.db.patch(args.keyId, { label: args.title });
    return true;
  },
});
