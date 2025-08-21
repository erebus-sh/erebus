import { Hono } from "hono";
import { helperRoute } from "./routes/helper";
import { v1Route } from "./routes/v1";
import { nanoid } from "nanoid";

interface Bindings {
  internalRequestId: string;
}

const app = new Hono<{
  Bindings: Bindings;
  Variables: { internalRequestId: string };
}>().basePath("/api");

// Middleware to assign an internal request ID to every request
app.use("*", async (c, next) => {
  const requestId = nanoid();
  c.set("internalRequestId", requestId);
  c.header("X-Internal-Request-Id", requestId);
  await next();
});

// Register main route handlers - let each index.ts handle its own sub-routing
const routes = app
  .route("/helper", helperRoute)
  .route("/v1", v1Route)
  .get("/health", (c) => {
    const id = c.get("internalRequestId");
    return c.json({ ok: true, internalRequestId: id }, 200);
  });

export default routes;
export type AppType = typeof routes;
