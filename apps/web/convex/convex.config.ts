import aggregate from "@convex-dev/aggregate/convex.config";
import { defineApp } from "convex/server";
import polar from "@convex-dev/polar/convex.config";

const app = defineApp();

/**=======================AGGREGATES=============================== */
// Main usage aggregate for project-based counting
app.use(aggregate, { name: "usageAggregate" });
// Aggregate for event type counting within projects
app.use(aggregate, { name: "usageByEventAggregate" });
// Aggregate for time-based counting (useful for analytics)
app.use(aggregate, { name: "usageByTimeAggregate" });
// Aggregate for API key based counting
app.use(aggregate, { name: "usageByApiKeyAggregate" });
// Aggregate for payload length tracking
app.use(aggregate, { name: "usageByPayloadAggregate" });
// Aggregate for event-time analytics (tuple key [event, timestamp])
app.use(aggregate, { name: "usageByEventTimeAggregate" });
/**=======================AGGREGATES=============================== */

app.use(polar);

export default app;
