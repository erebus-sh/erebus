import { mutation } from "../_generated/server";
import { v } from "convex/values";

export const trackUsage = mutation({
  args: {
    projectId: v.id("projects"),
    event: v.union(
      v.literal("websocket.connect"),
      v.literal("websocket.subscribe"),
      v.literal("websocket.message"),
    ),
    payloadLength: v.optional(v.number()),
    apiKeyId: v.optional(v.id("api_keys")),
  },
  handler: async (ctx: any, args: any) => {
    const { projectId, event, payloadLength, apiKeyId } = args;

    const timestamp = Date.now();

    // Insert usage record
    await ctx.db.insert("usage", {
      projectId,
      event,
      count: 1,
      payloadLength: payloadLength || 0,
      apiKeyId,
      timestamp,
    });

    console.log(`[CONVEX] Tracked usage: ${event} for project ${projectId}`);
  },
});

export const getUsageStats = mutation({
  args: {
    projectId: v.id("projects"),
    startTime: v.optional(v.number()),
    endTime: v.optional(v.number()),
  },
  handler: async (ctx: any, args: any) => {
    const { projectId, startTime, endTime } = args;

    const query = ctx.db
      .query("usage")
      .withIndex("by_project", (q: any) => q.eq("projectId", projectId));

    if (startTime) {
      query.filter((q: any) => q.gte(q.field("timestamp"), startTime));
    }
    if (endTime) {
      query.filter((q: any) => q.lte(q.field("timestamp"), endTime));
    }

    const results = await query.collect();

    // Aggregate by event type
    const stats = results.reduce((acc: any, record: any) => {
      const event = record.event;
      if (!acc[event]) {
        acc[event] = {
          count: 0,
          totalPayloadLength: 0,
          records: [],
        };
      }
      acc[event].count += record.count;
      acc[event].totalPayloadLength += record.payloadLength || 0;
      acc[event].records.push(record);
      return acc;
    }, {});

    return stats;
  },
});
