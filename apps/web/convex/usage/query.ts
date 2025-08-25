import { query } from "../_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import type { Doc } from "../_generated/dataModel";
import {
  getValidatedProjectBySlugWithOwnershipForQuery,
  getValidatedProjectWithOwnershipForQuery,
} from "../lib/guard";

export const getUsage = query({
  args: {
    projectSlug: v.string(),
    startTime: v.optional(v.number()),
    endTime: v.optional(v.number()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    page: Omit<Doc<"usage">, "apiKeyId">[];
    continueCursor?: string;
    isDone: boolean;
    totalCount: number;
  }> => {
    const { projectSlug, startTime, endTime, paginationOpts } = args;
    const { project } = await getValidatedProjectBySlugWithOwnershipForQuery(
      ctx,
      projectSlug,
    );

    let dbQuery = ctx.db
      .query("usage")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .order("desc"); // from newest to oldest

    if (startTime) {
      dbQuery = dbQuery.filter((q) => q.gte(q.field("timestamp"), startTime));
    }
    if (endTime) {
      dbQuery = dbQuery.filter((q) => q.lte(q.field("timestamp"), endTime));
    }

    const results = await dbQuery.paginate(paginationOpts);

    // Get total count for the same query conditions
    let countQuery = ctx.db
      .query("usage")
      .withIndex("by_project", (q) => q.eq("projectId", project._id));

    if (startTime) {
      countQuery = countQuery.filter((q) =>
        q.gte(q.field("timestamp"), startTime),
      );
    }
    if (endTime) {
      countQuery = countQuery.filter((q) =>
        q.lte(q.field("timestamp"), endTime),
      );
    }

    /**
     * TODO:
     * This is completely not efficient, but it's a good start (kinda of, can't scale)
     *
     * we must use an aggregate query to get the total count
     * https://www.convex.dev/components/aggregate
     */
    const allRecords = await countQuery.collect();
    const totalCount = allRecords.length;

    // Omit the apiKeyId field from each result in the page
    return {
      ...results,
      page: results.page.map(({ apiKeyId, ...rest }: Doc<"usage">) => rest),
      totalCount,
    };
  },
});

export const hasUsage = query({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args): Promise<boolean> => {
    const { projectId } = args;
    await getValidatedProjectWithOwnershipForQuery(ctx, projectId);

    // Check if there's any usage for this project
    const usage = await ctx.db
      .query("usage")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .first();

    return usage !== null;
  },
});
