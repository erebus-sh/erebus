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
