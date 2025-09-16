import { v } from "convex/values";
import { query } from "../_generated/server";
import { getValidatedProjectBySlugWithOwnershipForQuery } from "../lib/guard";
import { usageByEventTimeAggregate } from "../aggregaters/usageAggregater";
import { formatISO } from "date-fns";

// TODO: This code is roughly put together using Cursor AI and Some handwork, it works probably
//       but need more organization, cleanup, better tests and better documentation.

/**
 * Enhanced analytics query to get analytics for a project with support for
 * both daily and hourly granularity, with normalized data (filling gaps).
 * Fully optimized for millions of records using aggregates.
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

    // Use aggregates for ALL counting operations - no database queries for millions of records
    console.log(
      {
        tag: "analytics:getAnalytics:aggregateQuery",
        projectId: project._id,
        defaultStartTime,
        defaultEndTime,
      },
      "Querying aggregates for efficient counting - no database queries",
    );

    // Get total counts for each event type using event-time aggregate
    const [totalConnects, totalSubscribes, totalMessages] = await Promise.all([
      usageByEventTimeAggregate.count(ctx, {
        namespace: project._id,
        bounds: {
          lower: {
            key: ["websocket.connect", defaultStartTime],
            inclusive: true,
          },
          upper: {
            key: ["websocket.connect", defaultEndTime],
            inclusive: true,
          },
        },
      }),
      usageByEventTimeAggregate.count(ctx, {
        namespace: project._id,
        bounds: {
          lower: {
            key: ["websocket.subscribe", defaultStartTime],
            inclusive: true,
          },
          upper: {
            key: ["websocket.subscribe", defaultEndTime],
            inclusive: true,
          },
        },
      }),
      usageByEventTimeAggregate.count(ctx, {
        namespace: project._id,
        bounds: {
          lower: {
            key: ["websocket.message", defaultStartTime],
            inclusive: true,
          },
          upper: {
            key: ["websocket.message", defaultEndTime],
            inclusive: true,
          },
        },
      }),
    ]);

    console.log(
      {
        tag: "analytics:getAnalytics:aggregateCounts",
        totalConnects,
        totalSubscribes,
        totalMessages,
      },
      "Aggregate counts retrieved",
    );

    // For time-based grouping, we need to use the time aggregate with specific time buckets
    // This avoids querying millions of records from the database
    const periodMs =
      granularity === "hour" ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    const timeBuckets: Array<{ start: number; end: number; key: string }> = [];

    // Align a timestamp to the start of the bucket in UTC (mathematically using epoch ms)
    const alignToBucketStartUtc = (ts: number): number => {
      const bucketSize = periodMs;
      return ts - (ts % bucketSize);
    };

    // Generate time buckets for the entire range
    const alignedStart = alignToBucketStartUtc(defaultStartTime);
    for (let time = alignedStart; time <= defaultEndTime; time += periodMs) {
      const bucketEnd = Math.min(time + periodMs - 1, defaultEndTime);
      timeBuckets.push({
        start: time,
        end: bucketEnd,
        // Use ISO string in UTC for consistent client parsing
        key: formatISO(new Date(time)),
      });
    }

    // Get counts for each time bucket using aggregates
    const bucketCounts = await Promise.all(
      timeBuckets.map(async (bucket) => {
        const [connects, subscribes, messages] = await Promise.all([
          usageByEventTimeAggregate.count(ctx, {
            namespace: project._id,
            bounds: {
              lower: {
                key: ["websocket.connect", bucket.start],
                inclusive: true,
              },
              upper: {
                key: ["websocket.connect", bucket.end],
                inclusive: true,
              },
            },
          }),
          usageByEventTimeAggregate.count(ctx, {
            namespace: project._id,
            bounds: {
              lower: {
                key: ["websocket.subscribe", bucket.start],
                inclusive: true,
              },
              upper: {
                key: ["websocket.subscribe", bucket.end],
                inclusive: true,
              },
            },
          }),
          usageByEventTimeAggregate.count(ctx, {
            namespace: project._id,
            bounds: {
              lower: {
                key: ["websocket.message", bucket.start],
                inclusive: true,
              },
              upper: {
                key: ["websocket.message", bucket.end],
                inclusive: true,
              },
            },
          }),
        ]);

        return {
          date: bucket.key,
          connect: connects,
          subscribe: subscribes,
          message: messages,
        };
      }),
    );

    console.log(
      {
        tag: "analytics:getAnalytics:timeBucketsProcessed",
        bucketCount: bucketCounts.length,
        sampleBuckets: bucketCounts.slice(0, 3),
      },
      "Time bucket counts processed using aggregates",
    );

    // Sort the data chronologically
    const chartData = bucketCounts.sort((a, b) => a.date.localeCompare(b.date));

    console.log(
      {
        projectId: project._id,
        tag: "analytics:getAnalytics:finalResult",
        chartDataLength: chartData.length,
        sampleChartData: chartData.slice(0, 3),
        totalCounts: {
          connects: totalConnects,
          subscribes: totalSubscribes,
          messages: totalMessages,
        },
      },
      "Final analytics result - 100% aggregate-based, no database queries",
    );

    return {
      data: chartData,
      totalConnects,
      totalSubscribes,
      totalMessages,
      granularity,
      timeRange: {
        start: defaultStartTime,
        end: defaultEndTime,
      },
    };
  },
});
