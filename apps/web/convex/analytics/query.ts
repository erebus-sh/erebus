import { v } from "convex/values";
import { query } from "../_generated/server";
import { getValidatedProjectBySlugWithOwnershipForQuery } from "../lib/guard";

/**
 * This is a simple analytics query to get the analytics for a project.
 *
 * How many connects, message, over a period of time, we are trying to keep it simple
 * until we need more complex analytics.
 */
export const getAnalytics = query({
  args: {
    projectSlug: v.string(),
    startTime: v.optional(v.number()),
    endTime: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    data: Array<{
      date: string;
      connect: number;
      subscribe: number;
      message: number;
    }>;
    totalConnects: number;
    totalSubscribes: number;
    totalMessages: number;
  }> => {
    const { projectSlug, startTime, endTime } = args;

    // Validate project ownership and get project details
    const { project } = await getValidatedProjectBySlugWithOwnershipForQuery(
      ctx,
      projectSlug,
    );

    // Default to last 30 days if no time range specified
    const now = Date.now();
    const defaultStartTime = startTime || now - 30 * 24 * 60 * 60 * 1000;
    const defaultEndTime = endTime || now;

    // Get usage data for the project within the time range
    const dbQuery = ctx.db
      .query("usage")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .filter((q) => q.gte(q.field("timestamp"), defaultStartTime))
      .filter((q) => q.lte(q.field("timestamp"), defaultEndTime));

    const usageRecords = await dbQuery.collect();

    // Group by date and event type
    const analyticsData: Record<
      string,
      { connect: number; subscribe: number; message: number }
    > = {};

    for (const record of usageRecords) {
      const date = new Date(record.timestamp).toISOString().split("T")[0]; // YYYY-MM-DD format

      if (!analyticsData[date]) {
        analyticsData[date] = { connect: 0, subscribe: 0, message: 0 };
      }

      switch (record.event) {
        case "websocket.connect":
          analyticsData[date].connect++;
          break;
        case "websocket.subscribe":
          analyticsData[date].subscribe++;
          break;
        case "websocket.message":
          analyticsData[date].message++;
          break;
      }
    }

    // Convert to array format compatible with the chart
    const chartData = Object.entries(analyticsData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, counts]) => ({
        date,
        connect: counts.connect,
        subscribe: counts.subscribe,
        message: counts.message,
      }));

    return {
      data: chartData,
      totalConnects: usageRecords.filter(
        (r: { event: string }) => r.event === "websocket.connect",
      ).length,
      totalSubscribes: usageRecords.filter(
        (r: { event: string }) => r.event === "websocket.subscribe",
      ).length,
      totalMessages: usageRecords.filter(
        (r: { event: string }) => r.event === "websocket.message",
      ).length,
    };
  },
});
