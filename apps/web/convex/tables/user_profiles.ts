import { defineTable } from "convex/server";
import { v } from "convex/values";

export const user_profiles = defineTable({
  userId: v.id("users"), // Reference to the built-in Convex Auth user
  slug: v.string(), // Custom user-facing slug (e.g. "v0id-c0de")
  createdAt: v.number(),
})
  .index("by_slug", ["slug"])
  .index("by_user", ["userId"]);
