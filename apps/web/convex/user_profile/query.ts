import { v } from "convex/values";
import { query } from "../_generated/server";
import { api } from "../_generated/api";
import { ConvexError } from "convex/values";

export const getUserProfileBySlug = query({
  args: {
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(api.users.query.getMe);
    if (!user || !user._id) throw new ConvexError("User not found");

    const profile = await ctx.db
      .query("user_profiles")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();

    // Make sure the profile belongs to the current user
    if (!profile || profile.userId !== user._id) {
      throw new ConvexError(
        "User profile not found or not belongs to the user",
      );
    }

    return profile;
  },
});
