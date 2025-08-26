import type { Doc } from "../_generated/dataModel";
import { TableAggregate } from "@convex-dev/aggregate";
import type { Id } from "../_generated/dataModel";
import { components } from "../_generated/api";

// Main usage aggregate for project-based counting
export const usageAggregate = new TableAggregate<{
  Namespace: Id<"projects">;
  Key: null;
  DataModel: import("../_generated/dataModel").DataModel;
  TableName: "usage";
}>(components.usageAggregate, {
  namespace: (doc: Doc<"usage">) => doc.projectId,
  sortKey: () => null,
});

// Aggregate for event type counting within projects
export const usageByEventAggregate = new TableAggregate<{
  Namespace: Id<"projects">;
  Key: string; // event type key
  DataModel: import("../_generated/dataModel").DataModel;
  TableName: "usage";
}>(components.usageByEventAggregate, {
  namespace: (doc: Doc<"usage">) => doc.projectId,
  sortKey: (doc: Doc<"usage">) => doc.event,
});

// Aggregate for time-based counting (useful for analytics)
export const usageByTimeAggregate = new TableAggregate<{
  Namespace: Id<"projects">;
  Key: number; // timestamp
  DataModel: import("../_generated/dataModel").DataModel;
  TableName: "usage";
}>(components.usageByTimeAggregate, {
  namespace: (doc: Doc<"usage">) => doc.projectId,
  sortKey: (doc: Doc<"usage">) => doc.timestamp,
});

// Aggregate for API key based counting
export const usageByApiKeyAggregate = new TableAggregate<{
  Namespace: Id<"projects">;
  Key: Id<"api_keys"> | null;
  DataModel: import("../_generated/dataModel").DataModel;
  TableName: "usage";
}>(components.usageByApiKeyAggregate, {
  namespace: (doc: Doc<"usage">) => doc.projectId,
  sortKey: (doc: Doc<"usage">) => doc.apiKeyId ?? null,
});

// Aggregate for payload length tracking (useful for message events)
export const usageByPayloadAggregate = new TableAggregate<{
  Namespace: Id<"projects">;
  Key: number; // payloadLength
  DataModel: import("../_generated/dataModel").DataModel;
  TableName: "usage";
}>(components.usageByPayloadAggregate, {
  namespace: (doc: Doc<"usage">) => doc.projectId,
  sortKey: (doc: Doc<"usage">) => doc.payloadLength ?? 0,
});

// (Optional) If you need event-time tuple aggregation, add a component named
// "usageByEventTimeAggregate" to convex.config.ts and regenerate API.
export const usageByEventTimeAggregate = new TableAggregate<{
  Namespace: Id<"projects">;
  Key: [string, number];
  DataModel: import("../_generated/dataModel").DataModel;
  TableName: "usage";
}>(components.usageByEventTimeAggregate, {
  namespace: (doc: Doc<"usage">) => doc.projectId,
  sortKey: (doc: Doc<"usage">) => [doc.event, doc.timestamp],
});
