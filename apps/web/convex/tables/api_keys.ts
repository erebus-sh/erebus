import { defineTable } from "convex/server";
import { v } from "convex/values";

export const api_key_status = v.union(
  v.literal("active"),
  v.literal("disabled"),
  v.literal("revoked"),
);

export const api_keys = defineTable({
  projectId: v.id("projects"),
  createdBy: v.id("users"),
  key: v.string(),
  label: v.optional(v.string()),
  createdAt: v.number(),
  revokedAt: v.optional(v.number()),
  status: v.optional(api_key_status),
})
  .index("by_projectId", ["projectId"])
  .index("by_secret_key", ["key"]);
