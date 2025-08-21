import { defineTable } from "convex/server";
import { v } from "convex/values";

export const eventType = v.union(v.literal("message"));

export const usage = defineTable({
  projectId: v.id("projects"),
  apiKeyId: v.optional(v.id("api_keys")),
  event: eventType,
  count: v.number(),
  timestamp: v.number(),
})
  .index("by_project", ["projectId"])
  .index("by_api_key", ["apiKeyId"]);
