import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { audit_log_action } from "../tables/audit_log";
import { getProjectBySlug } from "../lib/guard";

export const createAuditLogInternal = internalMutation({
  args: {
    projectSlug: v.string(),
    action: audit_log_action,
    actorId: v.id("users"),
    entityType: v.string(),
    entityId: v.string(),
    status: v.boolean(),
    description: v.string(),
  },
  handler: async (ctx, args): Promise<boolean> => {
    // Ensure the project exists (auth is enforced by callers for internal usage)
    const project = await getProjectBySlug(ctx, args.projectSlug);

    // Temporary cast until Convex types include `audit_log` (run codegen to remove)
    await ctx.db.insert("audit_log", {
      actorId: args.actorId,
      action: args.action,
      entityType: args.entityType,
      entityId: args.entityId,
      projectId: project._id,
      status: args.status,
      description: args.description,
      createdAt: Date.now(),
    });

    return true;
  },
});
