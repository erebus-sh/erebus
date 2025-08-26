import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { getValidatedActiveKeyById } from "../lib/guard";
import {
  usageAggregate,
  usageByEventAggregate,
  usageByTimeAggregate,
  usageByApiKeyAggregate,
  usageByPayloadAggregate,
  usageByEventTimeAggregate,
} from "../aggregaters/usageAggregater";

export const schemaPayload = v.array(
  v.object({
    projectId: v.id("projects"),
    event: v.union(
      v.literal("websocket.connect"),
      v.literal("websocket.subscribe"),
      v.literal("websocket.message"),
    ),
    payloadLength: v.optional(v.number()),
    apiKeyId: v.id("api_keys"),
  }),
);

export const trackUsage = mutation({
  args: {
    payload: schemaPayload,
  },
  handler: async (ctx, args) => {
    const { payload } = args;

    // Validate all API keys are active before tracking usage
    for (const item of payload) {
      await getValidatedActiveKeyById(ctx, item.apiKeyId);
    }

    const timestamp = Date.now();

    // Insert usage records in parallel and collect inserted IDs
    const insertedIds = await Promise.all(
      payload.map(({ projectId, event, payloadLength, apiKeyId }, idx) =>
        ctx.db
          .insert("usage", {
            projectId,
            event,
            payloadLength: payloadLength || 0,
            apiKeyId,
            timestamp,
          })
          .then((id) => ({
            id,
            projectId,
            event,
            payloadLength: payloadLength || 0,
            apiKeyId,
            index: idx,
          })),
      ),
    );

    // Update aggregates for each inserted record
    await Promise.all(
      insertedIds.map(
        async ({ id, projectId, event, payloadLength, apiKeyId }) => {
          // Get the full document for aggregate insertion
          const doc = await ctx.db.get(id);
          if (!doc) return;

          // Insert into main usage aggregate
          await usageAggregate.insert(ctx, doc);

          // Insert into event-based aggregate
          await usageByEventAggregate.insert(ctx, doc);

          // Insert into time-based aggregate
          await usageByTimeAggregate.insert(ctx, doc);

          // Insert into event-time aggregate
          await usageByEventTimeAggregate.insert(ctx, doc);

          // Insert into API key based aggregate
          await usageByApiKeyAggregate.insert(ctx, doc);

          // Insert into payload length aggregate (only for message events)
          if (event === "websocket.message" && payloadLength) {
            await usageByPayloadAggregate.insert(ctx, doc);
          }
        },
      ),
    );

    // Improved logging: log each usage event tracked
    insertedIds.forEach(
      ({ id, projectId, event, payloadLength, apiKeyId, index }) => {
        console.log(
          `[CONVEX] [${index}] Tracked usage: event="${event}", projectId="${projectId}", payloadLength=${payloadLength}, apiKeyId=${apiKeyId ?? "N/A"}, usageId=${id}`,
        );
      },
    );

    // Return a summary of what was inserted
    return {
      success: true,
      count: insertedIds.length,
      inserted: insertedIds.map(
        ({ id, projectId, event, payloadLength, apiKeyId }) => ({
          id,
          projectId,
          event,
          payloadLength,
          apiKeyId,
        }),
      ),
      timestamp,
    };
  },
});
