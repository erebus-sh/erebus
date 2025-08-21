import { ConvexError, v } from "convex/values";
import { mutation } from "../_generated/server";
import { api } from "../_generated/api";
import slugify from "slugify";

export const createProject = mutation({
  args: {
    title: v.string(),
  },
  handler: async (ctx, args): Promise<string> => {
    const { title } = args;
    const user = await ctx.runQuery(api.users.query.getMe);
    if (!user || !user._id) throw new ConvexError("User not found");

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
      userId: user._id,
      slug: slugify(title, { lower: true }),
      createdAt: Date.now(),
      status: "active",
      region: "global",
    });

    if (!project) throw new ConvexError("Failed to create project");

    return slug;
  },
});
