import { api } from "../_generated/api";
import { ConvexError } from "convex/values";
import { DataModel, Id } from "../_generated/dataModel";
import { GenericMutationCtx, GenericQueryCtx } from "convex/server";

// Helper function to get authenticated user
export async function getAuthenticatedUser(ctx: GenericMutationCtx<DataModel>) {
  const user = await ctx.runQuery(api.users.query.getMe);
  if (!user || !user._id) {
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

// Helper function to validate project ownership
export async function getValidatedProjectWithOwnership(
  ctx: GenericMutationCtx<DataModel>,
  projectId: Id<"projects">,
) {
  const user = await getAuthenticatedUser(ctx);
  const project = await getValidatedProject(ctx, projectId);

  if (project.userId !== user._id) {
    throw new ConvexError("You are not the owner of this project");
  }

  return { user, project };
}

// Helper function to validate project access by slug with ownership
export async function getValidatedProjectBySlugWithOwnership(
  ctx: GenericMutationCtx<DataModel>,
  slug: string,
) {
  const user = await getAuthenticatedUser(ctx);
  const project = await getProjectBySlug(ctx, slug);

  if (project.userId !== user._id) {
    throw new ConvexError("You are not the owner of this project");
  }

  return { user, project };
}

// Helper function to validate usage access for a project
export async function validateUsageAccess(
  ctx: GenericMutationCtx<DataModel>,
  projectId: Id<"projects">,
) {
  const user = await getAuthenticatedUser(ctx);
  const project = await getValidatedProject(ctx, projectId);

  if (project.userId !== user._id) {
    throw new ConvexError("You are not the owner of this project");
  }

  return { user, project };
}

// Helper function to validate API key access and status by secret key
export async function getValidatedActiveKey(
  ctx: GenericMutationCtx<DataModel>,
  secretKey: string,
) {
  const key = await ctx.db
    .query("api_keys")
    .withIndex("by_secret_key", (q) => q.eq("key", secretKey))
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

  return key;
}

// Helper function to validate API key access and status by key ID
export async function getValidatedActiveKeyById(
  ctx: GenericMutationCtx<DataModel>,
  keyId: Id<"api_keys">,
) {
  const key = await ctx.db.get(keyId);

  if (!key) {
    throw new ConvexError("API key not found.");
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

  return key;
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

// Query-compatible guard functions
export async function getAuthenticatedUserForQuery(
  ctx: GenericQueryCtx<DataModel>,
) {
  const user = await ctx.runQuery(api.users.query.getMe);
  if (!user || !user._id) {
    throw new ConvexError("User not found");
  }
  return user;
}

export async function getValidatedProjectWithOwnershipForQuery(
  ctx: GenericQueryCtx<DataModel>,
  projectId: Id<"projects">,
) {
  const user = await getAuthenticatedUserForQuery(ctx);
  const project = await ctx.db.get(projectId);
  if (!project) throw new ConvexError("Project not found");

  if (project.userId !== user._id) {
    throw new ConvexError("You are not the owner of this project");
  }

  return { user, project };
}

export async function getValidatedProjectBySlugWithOwnershipForQuery(
  ctx: GenericQueryCtx<DataModel>,
  slug: string,
) {
  const user = await getAuthenticatedUserForQuery(ctx);
  const project = await ctx.runQuery(api.projects.query.getProjectBySlug, {
    slug,
  });
  if (!project) throw new ConvexError("Project not found");

  if (project.userId !== user._id) {
    throw new ConvexError("You are not the owner of this project");
  }

  return { user, project };
}

export async function getValidatedActiveKeyForQuery(
  ctx: GenericQueryCtx<DataModel>,
  secretKey: string,
) {
  const key = await ctx.db
    .query("api_keys")
    .withIndex("by_secret_key", (q) => q.eq("key", secretKey))
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

  return key;
}
