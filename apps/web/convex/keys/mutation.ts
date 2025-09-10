import { mutation } from "../_generated/server";
import { ConvexError, v } from "convex/values";
import { generateApiKey } from "../utils/api_key";
import { Doc, Id } from "../_generated/dataModel";
import {
  getAuthenticatedUser,
  getProjectBySlug,
  getValidatedAndAuthorizedKey,
  getValidatedProject,
} from "../lib/guard";
import { audit } from "../utils/audit";

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

    await audit(ctx, {
      project: project,
      action: "create",
      entityType: "api_key",
      entityId: api_key,
      status: true,
      user: user as Doc<"users">,
      description: `User ${user.name} created API key ${args.title}`,
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
    const project = await getValidatedProject(ctx, args.projectId);
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
      await audit(ctx, {
        project: project,
        action: "update",
        entityType: "api_key",
        entityId: args.keyId,
        user: user as Doc<"users">,
        status: false,
        description: `User ${user.name} attempted to revoke a non-existent API key`,
      });
      throw new ConvexError("API key not found");
    }

    if (key.status === "disabled") {
      await audit(ctx, {
        project: project,
        action: "update",
        entityType: "api_key",
        entityId: args.keyId,
        user: user as Doc<"users">,
        status: false,
        description: `User ${user.name} attempted to revoke a disabled API key`,
      });
      throw new ConvexError(
        "Cannot revoke a disabled key. Please re-enable the key first.",
      );
    }

    if (key.status === "revoked") {
      await audit(ctx, {
        project: project,
        action: "update",
        entityType: "api_key",
        entityId: args.keyId,
        user: user as Doc<"users">,
        status: false,
        description: `User ${user.name} attempted to revoke a revoked API key`,
      });
      throw new ConvexError("Key is already revoked");
    }

    await ctx.db.patch(args.keyId, {
      status: "revoked",
      revokedAt: Date.now(),
    });

    await audit(ctx, {
      project: project,
      action: "update",
      entityType: "api_key",
      entityId: args.keyId,
      user: user as Doc<"users">,
      status: true,
      description: `User ${user.name} revoked API key ${key.label}`,
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
    const project = await getValidatedProject(ctx, args.projectId);
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
      await audit(ctx, {
        project: project,
        action: "update",
        entityType: "api_key",
        entityId: args.keyId,
        user: user as Doc<"users">,
        status: false,
        description: `User ${user.name} attempted to update a non-existent API key`,
      });
      throw new ConvexError("API key not found");
    }

    if (key.status === "disabled") {
      await audit(ctx, {
        project: project,
        action: "update",
        entityType: "api_key",
        entityId: args.keyId,
        user: user as Doc<"users">,
        status: false,
        description: `User ${user.name} attempted to update a disabled API key`,
      });
      throw new ConvexError(
        "Cannot update a disabled key. Please re-enable the key first.",
      );
    }

    if (key.status === "revoked") {
      await audit(ctx, {
        project: project,
        action: "update",
        entityType: "api_key",
        entityId: args.keyId,
        user: user as Doc<"users">,
        status: false,
        description: `User ${user.name} attempted to update a revoked API key`,
      });
      throw new ConvexError("Key is already revoked and cannot be updated");
    }

    await ctx.db.patch(args.keyId, { label: args.title });

    await audit(ctx, {
      project: project,
      action: "update",
      entityType: "api_key",
      entityId: args.keyId,
      user: user as Doc<"users">,
      status: true,
      description: `User ${user.name} updated API key title to ${args.title}`,
    });
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
    const project = await getValidatedProject(ctx, args.projectId);
    await getValidatedAndAuthorizedKey(
      ctx,
      args.keyId,
      args.projectId,
      user._id,
      "update",
    );

    const key = await ctx.db.get(args.keyId);
    if (!key) {
      await audit(ctx, {
        project: project,
        action: "update",
        entityType: "api_key",
        entityId: args.keyId,
        user: user as Doc<"users">,
        status: false,
        description: `User ${user.name} attempted to toggle status of a non-existent API key`,
      });
      throw new ConvexError("API key not found");
    }

    // Don't allow toggling revoked keys
    if (key.status === "revoked") {
      await audit(ctx, {
        project: project,
        action: "update",
        entityType: "api_key",
        entityId: args.keyId,
        user: user as Doc<"users">,
        status: false,
        description: `User ${user.name} attempted to toggle status of a revoked API key`,
      });
      throw new ConvexError("Cannot toggle status of revoked key");
    }

    const newStatus = key.status === "active" ? "disabled" : "active";
    await ctx.db.patch(args.keyId, { status: newStatus });

    await audit(ctx, {
      project: project,
      action: "update",
      entityType: "api_key",
      entityId: args.keyId,
      user: user as Doc<"users">,
      status: true,
      description: `User ${user.name} toggled API key status to ${newStatus}`,
    });
    return newStatus;
  },
});
