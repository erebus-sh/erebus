import { api } from "../_generated/api";
import { ConvexError } from "convex/values";
import { DataModel, Id } from "../_generated/dataModel";
import { GenericMutationCtx } from "convex/server";

// Helper function to get authenticated user
export async function getAuthenticatedUser(ctx: GenericMutationCtx<DataModel>) {
  const user = await ctx.runQuery(api.users.query.getMe);
  if (!user) {
    throw new Error("User not found");
  }
  return user;
}

// Helper function to validate project access
export async function getValidatedProject(
  ctx: GenericMutationCtx<DataModel>,
  projectId: Id<"projects">,
) {
  const project = await ctx.db.get(projectId);
  if (!project) throw new ConvexError("Project not found");
  return project;
}

// Helper function to get project by slug
export async function getProjectBySlug(
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
export async function getValidatedAndAuthorizedKey(
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
