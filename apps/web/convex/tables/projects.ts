import { defineTable } from "convex/server";
import { v } from "convex/values";
import { Doc } from "../_generated/dataModel";

const projectStatus = v.union(v.literal("active"), v.literal("archived"));
const region = v.union(v.literal("global"), v.literal("eu"));

export const projects = defineTable({
  userId: v.id("users"), // Reference to the built-in Convex Auth user
  slug: v.string(), // Custom project-facing slug (e.g. "my-project-123")
  title: v.string(),
  status: projectStatus,
  region: region,
  webhookUrl: v.optional(v.string()),
  createdAt: v.number(),
})
  .index("by_user", ["userId"])
  .index("by_slug", ["slug"]);

export type ProjectStatus = Doc<"projects">["status"];
export type Region = Doc<"projects">["region"];
