import { Hono } from "hono";
import { helperRoute } from "./routes/helper";
import { v1Route } from "./routes/v1";
import { nanoid } from "nanoid";

interface Bindings {
  internalRequestId: string;
}

export const app = new Hono<{
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

app.route("/helper", helperRoute);
app.route("/v1", v1Route);

app.get("/health", (c) => {
  const id = c.get("internalRequestId");
  return c.json({ ok: true, internalRequestId: id });
});

export default app;
