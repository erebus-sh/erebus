import { Hono } from "hono";
import { fetchAction } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

export const databaseRoute = new Hono().get("/", async (c) => {
  const currentServerTime = await fetchAction(
    api.helper.action.getCurrentServerTime,
    {},
  );
  return c.json({ currentServerTime });
});
