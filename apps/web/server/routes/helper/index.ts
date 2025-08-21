import { Hono } from "hono";
import { timeRoute } from "./time";
import { databaseRoute } from "./database";

export const helperRoute = new Hono()
  .route("/time", timeRoute)
  .route("/database", databaseRoute);
