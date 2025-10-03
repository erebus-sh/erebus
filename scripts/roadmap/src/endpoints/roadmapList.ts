import { Bool, Num, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext, ListForRepoResponse, Roadmap } from "../types";
import { Octokit } from "octokit";

export class RoadmapList extends OpenAPIRoute {
  schema = {
    tags: ["Roadmap"],
    summary: "List Roadmap Items",
    description: "Retrieve roadmap items from GitHub issues",
    request: {
      query: z.object({
        page: Num({
          description: "Page number for pagination",
          default: 1,
        }),
        perPage: Num({
          description: "Number of items per page",
          default: 30,
        }),
        state: z
          .enum(["open", "closed", "all"])
          .optional()
          .describe("Filter by issue state"),
      }),
    },
    responses: {
      "200": {
        description: "Returns a list of roadmap items",
        content: {
          "application/json": {
            schema: z.object({
              success: Bool(),
              result: z.object({
                roadmap: Roadmap.array(),
                total: Num({ description: "Total number of items" }),
                page: Num({ description: "Current page number" }),
              }),
            }),
          },
        },
      },
    },
  };

  async handle(c: AppContext) {
    const octokit = new Octokit({ auth: c.env.GITHUB_TOKEN });

    // Get validated data
    const data = await this.getValidatedData<typeof this.schema>();

    // Retrieve the validated parameters
    const { page, perPage, state } = data.query;

    const roadMapIssues: ListForRepoResponse =
      await octokit.rest.issues.listForRepo({
        owner: "erebus-sh",
        repo: "roadmap",
        state: state || "all",
        labels: "roadmap,ticket",
        sort: "created",
        direction: "asc",
        page: page,
        per_page: perPage,
      });

    return {
      success: true,
      result: {
        roadmap: roadMapIssues.data.map((issue) => ({
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
        })),
        total: roadMapIssues.data.length,
        page: page,
      },
    };
  }
}
