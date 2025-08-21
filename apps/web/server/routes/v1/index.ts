import { Hono } from "hono";
import { grantRoute } from "./grant";
import { webhooks } from "./webhooks";

export const v1Route = new Hono()
  .route("/", grantRoute)
  .route("/webhooks", webhooks);
