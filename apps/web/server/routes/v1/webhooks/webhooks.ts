import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { UsagePayloadSchema } from "@repo/schemas/webhooks/usageRequest";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

export const webhooksRoute = new Hono().post(
  "/usage",
  zValidator("json", UsagePayloadSchema),
  async (c) => {
    const body = await c.req.valid("json");
    console.log("Received usage webhook:", body);

    const { event, data } = body;

    try {
      // Track usage in Convex database
      await fetchMutation(api.usage.mutation.trackUsage, {
        projectId: data.projectId,
        event,
        payloadLength: data.payloadLength || 0,
      });

      // Return success response
      return c.json({
        success: true,
        message: `Usage event ${event} processed successfully`,
        projectId: data.projectId,
      });
    } catch (error) {
      console.error("Error processing usage webhook:", error);
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        500,
      );
    }
  },
);
