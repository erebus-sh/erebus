import { api } from "../_generated/api";
import { mutation } from "../_generated/server";
import { ConvexError, v } from "convex/values";
import { generateApiKey } from "../utils/api_key";
import { DataModel, Id } from "../_generated/dataModel";
import { GenericMutationCtx } from "convex/server";

// Helper function to get authenticated user
async function getAuthenticatedUser(ctx: GenericMutationCtx<DataModel>) {
  const user = await ctx.runQuery(api.users.query.getMe);
  if (!user) {
    throw new Error("User not found");
  }
  return user;
}

// Helper function to validate project access
async function getValidatedProject(
  ctx: GenericMutationCtx<DataModel>,
  projectId: Id<"projects">,
) {
  const project = await ctx.db.get(projectId);
  if (!project) throw new ConvexError("Project not found");
  return project;
}

// Helper function to get project by slug
async function getProjectBySlug(
  ctx: GenericMutationCtx<DataModel>,
  slug: string,
) {
  const project = await ctx.runQuery(api.projects.query.getProjectBySlug, {
    slug,
  });
  if (!project) throw new ConvexError("Project not found");
  return project;
}

// Helper function to validate and authorize key access
async function getValidatedAndAuthorizedKey(
  ctx: GenericMutationCtx<DataModel>,
  keyId: Id<"api_keys">,
  projectId: Id<"projects">,
  userId: Id<"users"> | undefined,
  action: string,
) {
  const key = await ctx.db.get(keyId);
  if (!key) throw new ConvexError("Key not found");

  if (key.projectId !== projectId)
    throw new ConvexError("Key does not belong to this project");

  if (key.createdBy !== userId && userId !== undefined)
    throw new ConvexError(`You are not authorized to ${action} this key`);

  return key;
}

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

    await ctx.db.patch(args.keyId, { status: "revoked" });
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

    await ctx.db.patch(args.keyId, { label: args.title });
    return true;
  },
});
