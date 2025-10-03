import { Bool, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext, ListForRepoResponse, Roadmap } from "../types";
import { Octokit } from "octokit";

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
          "X-Cache-Age": z
            .string()
            .optional()
            .describe(
              "Age of the cached data in seconds (only present on cache HIT)",
            ),
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

    // Check cache with metadata
    const cachedData = await c.env.ROADMAP_GIT_ISSUES_CACHE.getWithMetadata<{
      timestamp: number;
    }>("roadmap");
    if (cachedData.value) {
      const cacheAge = cachedData.metadata?.timestamp
        ? Math.floor((Date.now() - cachedData.metadata.timestamp) / 1000)
        : 0;

      console.log(`Cache HIT - Age: ${cacheAge}s`);
      c.header("X-Cache-Status", "HIT");
      c.header("X-Cache-Age", cacheAge.toString());
      c.header("Cache-Control", `public, max-age=${CACHE_TTL}`);

      return c.json({
        success: true,
        roadmap: JSON.parse(cachedData.value as string),
      });
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
    const roadmap = roadMapIssues.data.map((issue) => ({
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

    // Store in cache with timestamp metadata
    await c.env.ROADMAP_GIT_ISSUES_CACHE.put(
      "roadmap",
      JSON.stringify(roadmap),
      {
        expirationTtl: CACHE_TTL,
        metadata: { timestamp: Date.now() },
      },
    );

    console.log("Cache MISS - Data fetched from GitHub and cached");
    c.header("X-Cache-Status", "MISS");
    c.header("Cache-Control", `public, max-age=${CACHE_TTL}`);

    return c.json({
      success: true,
      roadmap: roadmap,
    });
  }
}
