import { Arr, DateTime, Str } from "chanfana";
import type { Context } from "hono";
import { z } from "zod";
import { Env } from "../env";

export type AppContext = Context<{ Bindings: Env }>;

export const Roadmap = z.object({
  title: Str({ example: "lorem" }),
  id: Str(),
  description: Str({ required: false }),
  tags: Arr(Str({ required: false })),
  status: Str({ required: false }),
  date: DateTime(),
});
