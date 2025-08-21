import { Hono } from "hono";
import { webhooksRoute } from "./webhooks";

export const webhooks = new Hono().route("/", webhooksRoute);
