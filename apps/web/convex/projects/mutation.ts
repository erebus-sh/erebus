import { ConvexError, v } from "convex/values";
import { mutation } from "../_generated/server";
import { api } from "../_generated/api";
import slugify from "slugify";
import {
  getAuthenticatedUser,
  getValidatedProjectBySlugWithOwnership,
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
        "This project cannot be deleted because it has usage data.",
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

export const updateProjectWebhookUrl = mutation({
  args: {
    projectSlug: v.string(),
    webhookUrl: v.string(),
  },
  handler: async (ctx, args): Promise<boolean> => {
    const { projectSlug, webhookUrl } = args;
    const { project, user } = await getValidatedProjectBySlugWithOwnership(
      ctx,
      projectSlug,
    );

    // Validate webhook URL format
    if (webhookUrl.trim() !== "") {
      try {
        const url = new URL(webhookUrl);

        // Must be HTTPS
        if (url.protocol !== "https:") {
          throw new ConvexError("Webhook URL must use HTTPS protocol");
        }

        // Must have a valid hostname
        if (!url.hostname || url.hostname.length < 3) {
          throw new ConvexError("Webhook URL must have a valid domain name");
        }

        // Hostname must contain at least one dot (for domain)
        if (!url.hostname.includes(".")) {
          throw new ConvexError("Webhook URL must have a valid domain name");
        }

        // Check if it's a base URL (no path or just trailing slash)
        const pathname = url.pathname;
        if (pathname && pathname !== "/" && pathname.length > 1) {
          throw new ConvexError("Webhook URL must be a base URL");
        }
      } catch (error) {
        if (error instanceof ConvexError) {
          throw error;
        }
        throw new ConvexError(
          "Invalid webhook URL format. Must be a valid HTTPS URL",
        );
      }
    } else {
      throw new ConvexError("Webhook URL must be a valid HTTPS URL");
    }

    const oldWebhookUrl = project.webhookUrl || "";

    await ctx.db.patch(project._id, {
      webhookUrl,
    });

    // Log audit entry
    const { audit } = await import("../utils/audit");
    await audit(ctx, {
      user: user as any,
      project,
      action: "update",
      entityType: "project",
      entityId: project._id,
      status: true,
      description: `Webhook URL changed from "${oldWebhookUrl}" to "${webhookUrl}"`,
      actionDescription: "Updated project webhook URL",
    });

    return true;
  },
});

export const updateProjectName = mutation({
  args: {
    projectSlug: v.string(),
    title: v.string(),
  },
  handler: async (ctx, args): Promise<boolean> => {
    const { projectSlug, title } = args;

    if (title.length < 3)
      throw new ConvexError("Project name must be at least 3 characters long");
    if (title.length > 100)
      throw new ConvexError(
        "Project name must be less than 100 characters long",
      );

    const { project, user } = await getValidatedProjectBySlugWithOwnership(
      ctx,
      projectSlug,
    );

    const oldTitle = project.title;

    await ctx.db.patch(project._id, {
      title,
    });

    // Log audit entry
    const { audit } = await import("../utils/audit");
    await audit(ctx, {
      user: user as any,
      project,
      action: "update",
      entityType: "project",
      entityId: project._id,
      status: true,
      description: `Project name changed from "${oldTitle}" to "${title}"`,
      actionDescription: "Updated project name",
    });

    return true;
  },
});
