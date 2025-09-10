import { query } from "../_generated/server";
import { ConvexError, v } from "convex/values";
import { getValidatedProjectBySlugWithOwnershipForQuery } from "../lib/guard";
import type { AuditProps } from "../../components/audit";

export const getAuditLogsForProject = query({
  args: {
    projectSlug: v.string(),
  },
  handler: async (ctx, args): Promise<AuditProps[]> => {
    const { project } = await getValidatedProjectBySlugWithOwnershipForQuery(
      ctx,
      args.projectSlug,
    );

    const results = await ctx.db
      .query("audit_log")
      .withIndex("by_projectId", (q) => q.eq("projectId", project._id))
      .order("desc")
      .take(100);

    if (!results) {
      throw new ConvexError("No audit logs found");
    }

    const auditLogs: AuditProps[] = await Promise.all(
      results.map(async (result) => {
        const user = await ctx.db.get(result.actorId);
        if (!user) {
          throw new ConvexError("User not found");
        }
        if (typeof user.name !== "string") {
          throw new ConvexError("User name missing");
        }
        if (typeof result.description !== "string") {
          throw new ConvexError("Audit log description missing");
        }
        return {
          id: String(result._id),
          date: new Date(result.createdAt).toISOString(),
          title: user.name,
          action: result.actionDescription,
          description: result.description,
          image: user.image!,
        };
      }),
    );

    return auditLogs;
  },
});
