import { fromHono } from "chanfana";
import { Hono } from "hono";
import { RoadmapList } from "./endpoints/roadmapList";
import { Env } from "../env";

// Start a Hono app
const app = new Hono<{ Bindings: Env }>();

// Setup OpenAPI registry
const openapi = fromHono(app, {
  docs_url: "/",
});

// Register OpenAPI endpoints
openapi.get("/api/roadmap", RoadmapList);

export default app;
