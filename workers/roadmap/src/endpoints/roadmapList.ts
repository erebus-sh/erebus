import { Bool, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext, ListForRepoResponse, Roadmap } from "../types";
import { Octokit } from "octokit";
import { RoadmapListResponse } from "../types";

export class RoadmapList extends OpenAPIRoute {
  schema = {
    tags: ["Roadmap"],
    summary: "List All Roadmap Items",
    description:
      "Retrieve all roadmap items from GitHub issues. Cached for 15 minutes.",
    responses: {
      "200": {
        description: "Returns all roadmap items",
        headers: z.object({
          "X-Cache-Status": z
            .enum(["HIT", "MISS"])
            .describe("Indicates if the response was served from cache"),
        }),
        content: {
          "application/json": {
            schema: z.object({
              success: Bool(),
              roadmap: Roadmap.array(),
            }),
          },
        },
      },
    },
  };

  async handle(c: AppContext) {
    const octokit = new Octokit({ auth: c.env.GITHUB_TOKEN });

    const CACHE_TTL = 15 * 60; // 15 minutes in seconds

    // Check cache
    const cachedData = await c.env.ROADMAP_GIT_ISSUES_CACHE.get("roadmap");
    if (cachedData) {
      console.log("Cache HIT");
      c.header("X-Cache-Status", "HIT");
      c.header("Cache-Control", `public, max-age=${CACHE_TTL}`);

      return c.json({
        success: true,
        roadmap: JSON.parse(cachedData as string),
      }) as unknown as RoadmapListResponse;
    }

    const roadMapIssues: ListForRepoResponse =
      await octokit.rest.issues.listForRepo({
        owner: "erebus-sh",
        repo: "erebus",
        state: "all",
        labels: "roadmap,ticket",
        sort: "created",
        direction: "asc",
        per_page: 100,
      });
    const roadmap: Roadmap[] = roadMapIssues.data.map((issue) => ({
      id: issue.number.toString(),
      title: issue.title,
      description: issue.body || undefined,
      status: issue.state,
      labels: issue.labels.map((label) =>
        typeof label === "string" ? label : label.name || "",
      ),
      author: issue.user?.login || "unknown",
      createdAt: issue.created_at,
      updatedAt: issue.updated_at,
      url: issue.html_url,
    }));

    // Store in cache
    await c.env.ROADMAP_GIT_ISSUES_CACHE.put(
      "roadmap",
      JSON.stringify(roadmap),
      {
        expirationTtl: CACHE_TTL,
      },
    );

    console.log("Cache MISS - Data fetched from GitHub and cached");
    c.header("X-Cache-Status", "MISS");
    c.header("Cache-Control", `public, max-age=${CACHE_TTL}`);

    return c.json({
      success: true,
      roadmap,
    }) as unknown as RoadmapListResponse;
  }
}
