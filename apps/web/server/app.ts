import { Hono } from "hono";
import { helperRoute } from "./routes/helper";
import { v1Route } from "./routes/v1";
import { nanoid } from "nanoid";
import { youRoute } from "./routes/well-unknown";

interface Bindings {
  RequestId: string;
}

export const app = new Hono<{
  Bindings: Bindings;
  Variables: { RequestId: string };
}>().basePath("/api");

// Middleware to assign an internal request ID to every request
app.use("*", async (c, next) => {
  const requestId = nanoid();
  c.set("RequestId", requestId);
  c.header("X-Request-Id", requestId);
  await next();
});

// Register main route handlers - let each index.ts handle its own sub-routing
const routes = app
  .route("/helper", helperRoute)
  .route("/v1", v1Route)
  .route("/.complex", youRoute)
  .get("/health", (c) => {
    const id = c.get("RequestId");
    return c.json({ ok: true, RequestId: id }, 200);
  });

export default routes;
export type AppType = typeof routes;
