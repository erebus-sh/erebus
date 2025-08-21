import { defineTable } from "convex/server";
import { v } from "convex/values";

export const eventType = v.union(
  v.literal("websocket.connect"),
  v.literal("websocket.subscribe"),
  v.literal("websocket.message"),
);

export const usage = defineTable({
  projectId: v.id("projects"),
  apiKeyId: v.optional(v.id("api_keys")),
  event: eventType,
  count: v.number(),
  payloadLength: v.optional(v.number()), // For message events
  timestamp: v.number(),
})
  .index("by_project", ["projectId"])
  .index("by_api_key", ["apiKeyId"])
  .index("by_event", ["event"])
  .index("by_timestamp", ["timestamp"]);
