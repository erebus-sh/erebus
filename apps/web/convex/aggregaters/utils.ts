import type { QueryCtx, MutationCtx, ActionCtx } from "../_generated/server";
import type { Id, Doc } from "../_generated/dataModel";
import {
  usageAggregate,
  usageByEventAggregate,
  usageByTimeAggregate,
  usageByApiKeyAggregate,
  usageByPayloadAggregate,
  usageByEventTimeAggregate,
} from "./usageAggregater";

/**
 * Utility functions for common aggregate operations
 */

export interface UsageCounts {
  total: number;
  connects: number;
  subscribes: number;
  messages: number;
}

export interface TimeRange {
  startTime?: number;
  endTime?: number;
}

export const USAGE_EVENTS = [
  "websocket.connect",
  "websocket.subscribe",
  "websocket.message",
] as const;
export type UsageEvent = (typeof USAGE_EVENTS)[number];

export async function insertUsageIntoAggregates(
  ctx: MutationCtx | ActionCtx,
  doc: Doc<"usage">,
): Promise<void> {
  await Promise.all([
    usageAggregate.insert(ctx, doc),
    usageByEventAggregate.insert(ctx, doc),
    usageByTimeAggregate.insert(ctx, doc),
    usageByEventTimeAggregate.insert(ctx, doc),
    usageByApiKeyAggregate.insert(ctx, doc),
    ...(doc.event === "websocket.message" && doc.payloadLength
      ? [usageByPayloadAggregate.insert(ctx, doc)]
      : []),
  ]);
}

/**
 * Get comprehensive usage counts for a project
 */
export async function getProjectUsageCounts(
  ctx: QueryCtx,
  projectId: Id<"projects">,
  timeRange?: TimeRange,
): Promise<UsageCounts> {
  const [total, connects, subscribes, messages] = await Promise.all([
    // Total count
    usageAggregate.count(ctx, { namespace: projectId }),

    // Event type counts
    usageByEventAggregate.count(ctx, {
      namespace: projectId,
      bounds: {
        lower: { key: "websocket.connect", inclusive: true },
        upper: { key: "websocket.connect", inclusive: true },
      },
    }),

    usageByEventAggregate.count(ctx, {
      namespace: projectId,
      bounds: {
        lower: { key: "websocket.subscribe", inclusive: true },
        upper: { key: "websocket.subscribe", inclusive: true },
      },
    }),

    usageByEventAggregate.count(ctx, {
      namespace: projectId,
      bounds: {
        lower: { key: "websocket.message", inclusive: true },
        upper: { key: "websocket.message", inclusive: true },
      },
    }),
  ]);

  return { total, connects, subscribes, messages };
}

/**
 * Get usage count within a time range
 */
export async function getProjectUsageInTimeRange(
  ctx: QueryCtx,
  projectId: Id<"projects">,
  startTime: number,
  endTime: number,
): Promise<number> {
  return usageByTimeAggregate.count(ctx, {
    namespace: projectId,
    bounds: {
      lower: { key: startTime, inclusive: true },
      upper: { key: endTime, inclusive: true },
    },
  });
}

/**
 * Get API key usage count
 */
export async function getApiKeyUsageCount(
  ctx: QueryCtx,
  projectId: Id<"projects">,
  apiKeyId: Id<"api_keys">,
): Promise<number> {
  return usageByApiKeyAggregate.count(ctx, {
    namespace: projectId,
    bounds: {
      lower: { key: apiKeyId, inclusive: true },
      upper: { key: apiKeyId, inclusive: true },
    },
  });
}

/**
 * Get payload statistics for message events
 */
export async function getMessagePayloadStats(
  ctx: QueryCtx,
  projectId: Id<"projects">,
): Promise<{
  count: number;
  totalPayload: number;
  averagePayload: number;
  maxPayload: number;
  minPayload: number;
}> {
  const count = await usageByPayloadAggregate.count(ctx, {
    namespace: projectId,
  });

  if (count === 0) {
    return {
      count: 0,
      totalPayload: 0,
      averagePayload: 0,
      maxPayload: 0,
      minPayload: 0,
    };
  }

  const totalPayload = await usageByPayloadAggregate.sum(ctx, {
    namespace: projectId,
  });

  // Note: min/max operations would require additional aggregate methods
  // For now, we'll calculate these from the database if needed
  return {
    count,
    totalPayload: totalPayload || 0,
    averagePayload: (totalPayload || 0) / count,
    maxPayload: 0, // TODO: Implement when min/max is available
    minPayload: 0, // TODO: Implement when min/max is available
  };
}

/**
 * Check if a project has any usage
 */
export async function projectHasUsage(
  ctx: QueryCtx,
  projectId: Id<"projects">,
): Promise<boolean> {
  const count = await usageAggregate.count(ctx, {
    namespace: projectId,
  });
  return count > 0;
}

/**
 * Get usage summary for dashboard
 */
export async function getUsageSummary(
  ctx: QueryCtx,
  projectId: Id<"projects">,
): Promise<{
  totalUsage: number;
  recentUsage: number; // Last 24 hours
  eventBreakdown: {
    connects: number;
    subscribes: number;
    messages: number;
  };
  hasUsage: boolean;
}> {
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;

  const [totalUsage, recentUsage, eventBreakdown] = await Promise.all([
    usageAggregate.count(ctx, { namespace: projectId }),

    usageByTimeAggregate.count(ctx, {
      namespace: projectId,
      bounds: {
        lower: { key: oneDayAgo, inclusive: true },
      },
    }),

    getProjectUsageCounts(ctx, projectId),
  ]);

  return {
    totalUsage,
    recentUsage,
    eventBreakdown: {
      connects: eventBreakdown.connects,
      subscribes: eventBreakdown.subscribes,
      messages: eventBreakdown.messages,
    },
    hasUsage: totalUsage > 0,
  };
}
