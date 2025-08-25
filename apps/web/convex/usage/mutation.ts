import { mutation } from "../_generated/server";
import { v } from "convex/values";

export const schemaPayload = v.array(
  v.object({
    projectId: v.id("projects"),
    event: v.union(
      v.literal("websocket.connect"),
      v.literal("websocket.subscribe"),
      v.literal("websocket.message"),
    ),
    payloadLength: v.optional(v.number()),
    apiKeyId: v.optional(v.id("api_keys")),
  }),
);

export const trackUsage = mutation({
  args: {
    payload: schemaPayload,
  },
  handler: async (ctx, args) => {
    const { payload } = args;

    const timestamp = Date.now();

    // Insert usage records in parallel and collect inserted IDs
    const insertedIds = await Promise.all(
      payload.map(({ projectId, event, payloadLength, apiKeyId }, idx) =>
        ctx.db
          .insert("usage", {
            projectId,
            event,
            count: 1,
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
