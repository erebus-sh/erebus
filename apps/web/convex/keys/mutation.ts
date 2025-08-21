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
