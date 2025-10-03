import { Arr, DateTime, Str } from "chanfana";
import type { Context } from "hono";
import { z } from "zod";
import { Env } from "../env";
import type { RestEndpointMethodTypes } from "@octokit/plugin-rest-endpoint-methods";

export type AppContext = Context<{ Bindings: Env }>;

export const Roadmap = z.object({
  id: Str({ description: "Issue number" }),
  title: Str({ description: "Issue title" }),
  description: Str({ required: false, description: "Issue body/description" }),
  status: Str({ description: "Issue state (open/closed)" }),
  labels: Arr(Str(), { description: "Issue labels" }),
  author: Str({ description: "Issue creator username" }),
  createdAt: DateTime({ description: "Issue creation date" }),
  updatedAt: DateTime({ description: "Issue last update date" }),
  url: Str({ description: "Issue HTML URL" }),
});

export type ListForRepoResponse =
  RestEndpointMethodTypes["issues"]["listForRepo"]["response"];

export interface Roadmap {
  id: string;
  title: string;
  description: string;
  status: string;
  labels: string[];
  author: string;
  createdAt: string;
  updatedAt: string;
  url: string;
}

export interface RoadmapListResponse {
  success: boolean;
  roadmap: Roadmap[];
}
