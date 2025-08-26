import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import {
  usageAggregate,
  usageByEventAggregate,
  usageByTimeAggregate,
  usageByApiKeyAggregate,
  usageByPayloadAggregate,
} from "../aggregaters/usageAggregater";

// Trigger to maintain aggregates when usage records are inserted
export const onUsageInserted = internalMutation({
  args: { usageId: v.id("usage") },
  handler: async (ctx, args) => {
    const usage = await ctx.db.get(args.usageId);
    if (!usage) return;

    // Insert into all relevant aggregates
    await Promise.all([
      usageAggregate.insert(ctx, usage),
      usageByEventAggregate.insert(ctx, usage),
      usageByTimeAggregate.insert(ctx, usage),
      usageByApiKeyAggregate.insert(ctx, usage),
      // Only insert into payload aggregate for message events
      ...(usage.event === "websocket.message" && usage.payloadLength
        ? [usageByPayloadAggregate.insert(ctx, usage)]
        : []),
    ]);
  },
});

// Trigger to maintain aggregates when usage records are updated
export const onUsageUpdated = internalMutation({
  args: { usageId: v.id("usage") },
  handler: async (ctx, args) => {
    const usage = await ctx.db.get(args.usageId);
    if (!usage) return;

    // For updates, we need to remove the old record and insert the new one
    // This is a simplified approach - in production you might want to track the old values
    await Promise.all([
      usageAggregate.insert(ctx, usage),
      usageByEventAggregate.insert(ctx, usage),
      usageByTimeAggregate.insert(ctx, usage),
      usageByApiKeyAggregate.insert(ctx, usage),
      // Only insert into payload aggregate for message events
      ...(usage.event === "websocket.message" && usage.payloadLength
        ? [usageByPayloadAggregate.insert(ctx, usage)]
        : []),
    ]);
  },
});
