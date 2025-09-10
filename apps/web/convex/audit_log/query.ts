import { query } from "../_generated/server";
import { v } from "convex/values";
import { getValidatedProjectBySlugWithOwnershipForQuery } from "../lib/guard";

export const getAuditLogsForProject = query({
  args: {
    projectSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const { project } = await getValidatedProjectBySlugWithOwnershipForQuery(
      ctx,
      args.projectSlug,
    );

    const results = await ctx.db
      .query("audit_log")
      .withIndex("by_projectId", (q) => q.eq("projectId", project._id))
      .order("desc")
      .take(100);

    return results;
  },
});
