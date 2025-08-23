import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { generateApiKey } from "../utils/api_key";
import { Id } from "../_generated/dataModel";
import {
  getAuthenticatedUser,
  getProjectBySlug,
  getValidatedAndAuthorizedKey,
  getValidatedProject,
} from "../lib/guard";

export const createKey = mutation({
  args: {
    title: v.string(),
    projectSlug: v.string(),
    dev: v.boolean(),
  },
  handler: async (ctx, args): Promise<string> => {
    const user = await getAuthenticatedUser(ctx);
    const project = await getProjectBySlug(ctx, args.projectSlug);

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
    projectId: v.id("projects"),
  },
  handler: async (ctx, args): Promise<boolean> => {
    const user = await getAuthenticatedUser(ctx);
    await getValidatedProject(ctx, args.projectId);
    await getValidatedAndAuthorizedKey(
      ctx,
      args.keyId,
      args.projectId,
      user._id,
      "revoke",
    );

    // Check if key is disabled - if so, prevent revocation
    const key = await ctx.db.get(args.keyId);
    if (!key) {
      throw new Error("API key not found");
    }

    if (key.status === "disabled") {
      throw new Error(
        "Cannot revoke a disabled key. Please re-enable the key first.",
      );
    }

    if (key.status === "revoked") {
      throw new Error("Key is already revoked");
    }

    await ctx.db.patch(args.keyId, {
      status: "revoked",
      revokedAt: Date.now(),
    });
    return true;
  },
});

export const updateKey = mutation({
  args: {
    keyId: v.id("api_keys"),
    projectId: v.id("projects"),
    title: v.string(),
  },
  handler: async (ctx, args): Promise<boolean> => {
    const user = await getAuthenticatedUser(ctx);
    await getValidatedProject(ctx, args.projectId);
    await getValidatedAndAuthorizedKey(
      ctx,
      args.keyId,
      args.projectId,
      user._id,
      "update",
    );

    // Check if key is disabled - if so, prevent updates
    const key = await ctx.db.get(args.keyId);
    if (!key) {
      throw new Error("API key not found");
    }

    if (key.status === "disabled") {
      throw new Error(
        "Cannot update a disabled key. Please re-enable the key first.",
      );
    }

    if (key.status === "revoked") {
      throw new Error("Key is already revoked and cannot be updated");
    }

    await ctx.db.patch(args.keyId, { label: args.title });
    return true;
  },
});

export const toggleKeyStatus = mutation({
  args: {
    keyId: v.id("api_keys"),
    projectId: v.id("projects"),
  },
  handler: async (ctx, args): Promise<string> => {
    const user = await getAuthenticatedUser(ctx);
    await getValidatedProject(ctx, args.projectId);
    await getValidatedAndAuthorizedKey(
      ctx,
      args.keyId,
      args.projectId,
      user._id,
      "update",
    );

    const key = await ctx.db.get(args.keyId);
    if (!key) {
      throw new Error("API key not found");
    }

    // Don't allow toggling revoked keys
    if (key.status === "revoked") {
      throw new Error("Cannot toggle status of revoked key");
    }

    const newStatus = key.status === "active" ? "disabled" : "active";
    await ctx.db.patch(args.keyId, { status: newStatus });
    return newStatus;
  },
});
