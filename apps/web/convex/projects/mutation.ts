import { ConvexError, v } from "convex/values";
import { mutation } from "../_generated/server";
import { api } from "../_generated/api";
import slugify from "slugify";
import {
  getAuthenticatedUser,
  getValidatedProjectWithOwnership,
} from "../lib/guard";

export const createProject = mutation({
  args: {
    title: v.string(),
  },
  handler: async (ctx, args): Promise<string> => {
    const { title } = args;
    const user = await getAuthenticatedUser(ctx);

    const exsistingProject = await ctx.runQuery(api.projects.query.getProjects);

    if (exsistingProject.length >= 50) {
      throw new ConvexError("You have reached the maximum number of projects");
    }

    if (title.length < 3)
      throw new ConvexError("Project name must be at least 3 characters long");
    if (title.length > 100)
      throw new ConvexError(
        "Project name must be less than 100 characters long",
      );

    const slug = slugify(title, { lower: true });

    const project = await ctx.db.insert("projects", {
      title,
      userId: user._id!,
      slug: slugify(title, { lower: true }),
      createdAt: Date.now(),
      status: "active",
      region: "global",
    });

    if (!project) throw new ConvexError("Failed to create project");

    return slug;
  },
});

export const deleteProject = mutation({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args): Promise<{ success: boolean }> => {
    const { projectId } = args;
    await getValidatedProjectWithOwnership(ctx, projectId);

    // Check if the project has any usage before deleting
    const hasUsage = await ctx.runQuery(api.usage.query.hasUsage, {
      projectId,
    });

    if (hasUsage) {
      throw new ConvexError(
        "Cannot delete project with existing usage. Please delete all usage data first.",
      );
    }

    // Cascade delete: Delete all API keys associated with this project
    const apiKeys = await ctx.db
      .query("api_keys")
      .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
      .collect();

    for (const apiKey of apiKeys) {
      await ctx.db.delete(apiKey._id);
    }

    // Delete the project itself
    await ctx.db.delete(projectId);

    return {
      success: true,
    };
  },
});
