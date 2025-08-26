import { query } from "../_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import type { Doc } from "../_generated/dataModel";
import {
  getValidatedProjectBySlugWithOwnershipForQuery,
  getValidatedProjectWithOwnershipForQuery,
} from "../lib/guard";
import {
  usageAggregate,
  usageByTimeAggregate,
} from "../aggregaters/usageAggregater";

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

    // For pagination, we still need to query the database to get the actual records
    // But we use aggregates for efficient counting
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

    // Use aggregates for efficient total count - this is the critical optimization
    let totalCount: number;

    if (startTime && endTime) {
      // Count within time range using time-based aggregate
      totalCount = await usageByTimeAggregate.count(ctx, {
        namespace: project._id,
        bounds: {
          lower: { key: startTime, inclusive: true },
          upper: { key: endTime, inclusive: true },
        },
      });
    } else if (startTime) {
      // Count from start time onwards using time-based aggregate
      totalCount = await usageByTimeAggregate.count(ctx, {
        namespace: project._id,
        bounds: {
          lower: { key: startTime, inclusive: true },
        },
      });
    } else if (endTime) {
      // Count up to end time using time-based aggregate
      totalCount = await usageByTimeAggregate.count(ctx, {
        namespace: project._id,
        bounds: {
          upper: { key: endTime, inclusive: true },
        },
      });
    } else {
      // Total count for project using main aggregate
      totalCount = await usageAggregate.count(ctx, {
        namespace: project._id,
      });
    }

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

    // Use aggregate for efficient existence check - no database query needed
    const count = await usageAggregate.count(ctx, {
      namespace: projectId,
    });

    return count > 0;
  },
});
