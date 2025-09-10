import { defineTable } from "convex/server";
import { v } from "convex/values";

export const audit_log_action = v.union(
  v.literal("create"),
  v.literal("update"),
  v.literal("delete"),
);

export const audit_log = defineTable({
  actorId: v.string(), // who did it
  action: audit_log_action, // what happened
  entityType: v.optional(v.string()), // resource type
  entityId: v.optional(v.string()), // resource id
  projectId: v.optional(v.string()), // scope: which project this event belongs to
  description: v.optional(v.string()), // human-readable summary
  status: v.optional(v.boolean()), // success/failure
  createdAt: v.number(), // timestamp
})
  .index("by_actorId", ["actorId"])
  .index("by_projectId", ["projectId"])
  .index("by_action", ["action"])
  .index("by_entity", ["entityType", "entityId"]);
