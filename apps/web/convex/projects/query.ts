import { api } from "../_generated/api";
import { query } from "../_generated/server";
import { Doc } from "../_generated/dataModel";
import { ConvexError, v } from "convex/values";
import { getAuthenticatedUserForQuery } from "../lib/guard";

export const getProjects = query({
  handler: async (ctx): Promise<Doc<"projects">[]> => {
    const user = await getAuthenticatedUserForQuery(ctx);

    // Limit the number of projects to 50 for safety
    const projects: Doc<"projects">[] = await ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", user._id!))
      .take(50);

    // .take always returns an array, so this check is not strictly necessary,
    // but we can keep it for consistency if desired.
    if (!projects) throw new ConvexError("Failed to get projects");

    return projects;
  },
});

export const getProjectBySlug = query({
  args: {
    slug: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Doc<"projects"> | null> => {
    const user = await ctx.runQuery(api.users.query.getMe);
    if (!user || !user._id) return null;

    if (!args.slug || args.slug === "" || args.slug.length === 0) {
      // Just return null it's more graceful in our case than throwing,
      // because it's used as a guard in guard-layout.tsx
      return null;
    }

    if (args.slug.length > 100) {
      throw new ConvexError("Slug is too long");
    }

    if (args.slug.length < 3) {
      throw new ConvexError("Slug is too short");
    }

    // Find the project with the given slug and owned by the user
    const project = await ctx.db
      .query("projects")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug!))
      .first();

    // Optionally, check that the user owns the project
    if (!project || project.userId !== user._id) {
      throw new ConvexError("Project not found or not owned by user");
    }

    return project;
  },
});
