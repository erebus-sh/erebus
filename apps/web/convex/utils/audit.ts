import { internal } from "../_generated/api";
import { MutationCtx } from "../_generated/server";
import { Doc } from "../_generated/dataModel";
import { audit_log_action } from "../tables/audit_log";

/**
 * Write an audit log entry.
 */
export async function audit(
  ctx: MutationCtx,
  params: {
    user: Doc<"users">;
    project: Doc<"projects">;
    action: typeof audit_log_action.type;
    entityType: string;
    entityId: string;
    status: boolean;
    description: string;
  },
): Promise<void> {
  const { user, project, action, entityType, entityId, status, description } =
    params;
  await ctx.runMutation(internal.audit_log.mutation.createAuditLogInternal, {
    projectSlug: project.slug,
    action,
    actorId: user._id,
    entityType,
    entityId,
    status,
    description,
  });
}
