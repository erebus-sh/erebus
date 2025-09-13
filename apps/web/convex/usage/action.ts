import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { ingestMetersForUserId } from "../polar/meters";

export const schemaPayload = v.array(
  v.object({
    projectId: v.id("projects"),
    event: v.union(
      v.literal("websocket.connect"),
      v.literal("websocket.subscribe"),
      v.literal("websocket.message"),
    ),
    payloadLength: v.optional(v.number()),
    apiKeyId: v.id("api_keys"),
  }),
);

export const trackUsage = action({
  args: {
    payload: schemaPayload,
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    success: boolean;
    totalCount: number;
    projects: Array<{
      projectId: string;
      totalRows: number;
      eventCounts: Record<string, number>;
      totalPayloadLength: number;
    }>;
    timestamp: number;
  }> => {
    const result = await ctx.runMutation(internal.usage.mutation.trackUsage, {
      payload: args.payload,
    });

    // Extract unique project IDs to minimize database calls
    const uniqueProjectIds = [
      ...new Set(args.payload.map((item) => item.projectId)),
    ];

    // Get all projects in parallel and build userId -> usage count mapping
    const projects = await Promise.all(
      uniqueProjectIds.map((projectId) =>
        ctx.runQuery(internal.projects.query.getProjectById, { id: projectId }),
      ),
    );

    // Build userId -> total usage count mapping
    const userUsageCounts = new Map<string, number>();

    projects.forEach((project, index: number) => {
      if (!project) return; // Skip if project is null

      const projectId = uniqueProjectIds[index];
      const userId = project.userId as string;

      // Find the project summary in the result to get accurate count
      const projectSummary = result.projects.find(
        (p: { projectId: string }) => p.projectId === projectId,
      );
      const usageCount = projectSummary?.totalRows || 0;

      userUsageCounts.set(
        userId,
        (userUsageCounts.get(userId) || 0) + usageCount,
      );
    });

    // Bill each user for their actual usage count
    await Promise.all(
      Array.from(userUsageCounts.entries()).map(
        async ([userId, usageCount]: [string, number]) => {
          await ingestMetersForUserId(userId, usageCount);
        },
      ),
    );

    return result;
  },
});
