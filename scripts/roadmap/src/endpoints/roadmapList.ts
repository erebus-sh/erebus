import { Bool, Num, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext, Roadmap } from "../types";
import { Octokit } from "octokit";

export class RoadmapList extends OpenAPIRoute {
  schema = {
    tags: ["Roadmap"],
    summary: "List Roadmap",
    request: {
      query: z.object({
        page: Num({
          description: "Page number",
          default: 0,
        }),
        isCompleted: Bool({
          description: "Filter by completed flag",
          required: false,
        }),
      }),
    },
    responses: {
      "200": {
        description: "Returns a list of roadmap",
        content: {
          "application/json": {
            schema: z.object({
              series: z.object({
                success: Bool(),
                result: z.object({
                  roadmap: Roadmap.array(),
                }),
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
    const { page, isCompleted } = data.query;

    // Implement your own object list here

    return {
      success: true,
      tasks: [
        {
          name: "Clean my room",
          slug: "clean-room",
          description: null,
          completed: false,
          due_date: "2025-01-05",
        },
        {
          name: "Build something awesome with Cloudflare Workers",
          slug: "cloudflare-workers",
          description: "Lorem Ipsum",
          completed: true,
          due_date: "2022-12-24",
        },
      ],
    };
  }
}
