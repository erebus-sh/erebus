import { Hono } from "hono";
import { grantRoute } from "./grant";
import { webhooks } from "./webhooks";

export const v1Route = new Hono();

v1Route.route("/", grantRoute);
v1Route.route("/webhooks", webhooks);
