import { v } from "convex/values";
import { query } from "../_generated/server";
import { getValidatedProjectBySlugWithOwnershipForQuery } from "../lib/guard";

/**
 * Enhanced analytics query to get analytics for a project with support for
 * both daily and hourly granularity, with normalized data (filling gaps).
 */
export const getAnalytics = query({
  args: {
    projectSlug: v.string(),
    startTime: v.optional(v.number()),
    endTime: v.optional(v.number()),
    granularity: v.optional(v.union(v.literal("day"), v.literal("hour"))),
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
    granularity: "day" | "hour";
    timeRange: {
      start: number;
      end: number;
    };
  }> => {
    console.log(
      { tag: "analytics:getAnalytics:start", args },
      "Starting getAnalytics query",
    );

    const { projectSlug, startTime, endTime, granularity = "day" } = args;

    console.log(
      { tag: "analytics:getAnalytics:validateProject", projectSlug },
      "Validating project ownership and fetching project details",
    );
    // Validate project ownership and get project details
    const { project } = await getValidatedProjectBySlugWithOwnershipForQuery(
      ctx,
      projectSlug,
    );
    console.log(
      {
        tag: "analytics:getAnalytics:projectValidated",
        projectId: project._id,
      },
      "Project validated",
    );

    // Default time range based on granularity (all calculations in UTC)
    const now = Date.now(); // UTC timestamp
    let defaultStartTime: number;

    if (granularity === "hour") {
      // Last 24 hours for hourly view
      defaultStartTime = startTime || now - 24 * 60 * 60 * 1000;
    } else {
      // Last 30 days for daily view
      defaultStartTime = startTime || now - 30 * 24 * 60 * 60 * 1000;
    }

    const defaultEndTime = endTime || now;
    console.log(
      {
        tag: "analytics:getAnalytics:timeRange",
        defaultStartTime,
        defaultEndTime,
        startTime,
        endTime,
        granularity,
      },
      "Using time range for analytics query",
    );

    // Get usage data for the project within the time range
    console.log(
      {
        tag: "analytics:getAnalytics:dbQuery",
        projectId: project._id,
        defaultStartTime,
        defaultEndTime,
      },
      "Querying usage data from database",
    );

    const dbQuery = ctx.db
      .query("usage")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .filter((q) => q.gte(q.field("timestamp"), defaultStartTime))
      .filter((q) => q.lte(q.field("timestamp"), defaultEndTime));

    // Helper function to format timestamp based on granularity in UTC
    // IMPORTANT: Uses UTC methods to ensure consistent date formatting regardless of server timezone
    const formatKey = (timestamp: number): string => {
      const date = new Date(timestamp);
      if (granularity === "hour") {
        // YYYY-MM-DD HH:00 format in UTC
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, "0");
        const day = String(date.getUTCDate()).padStart(2, "0");
        const hour = String(date.getUTCHours()).padStart(2, "0");
        return `${year}-${month}-${day} ${hour}:00`;
      } else {
        // YYYY-MM-DD format in UTC
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, "0");
        const day = String(date.getUTCDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      }
    };

    const usageRecords = await dbQuery.collect();
    console.log(
      {
        tag: "analytics:getAnalytics:recordsFound",
        count: usageRecords.length,
        sampleRecords: usageRecords.slice(0, 3).map((r) => ({
          timestamp: r.timestamp,
          event: r.event,
          utcDate: new Date(r.timestamp).toISOString(),
          formattedKey: formatKey(r.timestamp),
        })),
      },
      "Usage records retrieved from database",
    );

    // Group by time period and event type
    const analyticsData: Record<
      string,
      { connect: number; subscribe: number; message: number }
    > = {};

    for (const record of usageRecords) {
      const key = formatKey(record.timestamp);

      if (!analyticsData[key]) {
        analyticsData[key] = { connect: 0, subscribe: 0, message: 0 };
      }

      switch (record.event) {
        case "websocket.connect":
          analyticsData[key].connect++;
          break;
        case "websocket.subscribe":
          analyticsData[key].subscribe++;
          break;
        case "websocket.message":
          analyticsData[key].message++;
          break;
      }
    }

    // Generate all time periods in the range to normalize data (fill gaps)
    const normalizedData: Record<
      string,
      { connect: number; subscribe: number; message: number }
    > = {};

    const periodMs =
      granularity === "hour" ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

    for (
      let time = defaultStartTime;
      time <= defaultEndTime;
      time += periodMs
    ) {
      const key = formatKey(time);
      normalizedData[key] = analyticsData[key] || {
        connect: 0,
        subscribe: 0,
        message: 0,
      };
    }

    console.log(
      {
        tag: "analytics:getAnalytics:dataProcessed",
        rawDataCount: Object.keys(analyticsData).length,
        normalizedDataCount: Object.keys(normalizedData).length,
        sampleRawData: Object.entries(analyticsData).slice(0, 3),
        sampleNormalizedData: Object.entries(normalizedData).slice(0, 5),
      },
      "Data processing complete",
    );

    // Convert to array format compatible with the chart
    const chartData = Object.entries(normalizedData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, counts]) => ({
        date,
        connect: counts.connect,
        subscribe: counts.subscribe,
        message: counts.message,
      }));

    console.log(
      {
        tag: "analytics:getAnalytics:finalResult",
        chartDataLength: chartData.length,
        sampleChartData: chartData.slice(0, 3),
        totalCounts: {
          connects: usageRecords.filter((r) => r.event === "websocket.connect")
            .length,
          subscribes: usageRecords.filter(
            (r) => r.event === "websocket.subscribe",
          ).length,
          messages: usageRecords.filter((r) => r.event === "websocket.message")
            .length,
        },
      },
      "Final analytics result",
    );

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
      granularity,
      timeRange: {
        start: defaultStartTime,
        end: defaultEndTime,
      },
    };
  },
});
