import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { UsageEventSchema } from "@repo/schemas/webhooks/usageRequest";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { verifyHmac } from "@repo/shared/utils/hmac";
import { Id } from "@/convex/_generated/dataModel";
import { z } from "zod";

export const webhooksRoute = new Hono()
  .use(async (c, next) => {
    const secret = process.env.WEBHOOK_SECRET;
    if (!secret) {
      console.error(
        "[middleware][webhook][error] WEBHOOK_SECRET environment variable is not set",
      );
      return c.json(
        { error: "Server misconfiguration: WEBHOOK_SECRET missing" },
        500,
      );
    }

    const hmacHeader = c.req.header("X-Erebus-Hmac");
    console.log("[middleware][webhook] hmacHeader", hmacHeader);
    if (!hmacHeader) {
      console.warn("[middleware][webhook][warn] Missing X-Erebus-Hmac header");
      return c.json({ error: "Missing X-Erebus-Hmac header" }, 401);
    }

    // Read the raw body for HMAC verification
    const payload = await c.req.text();

    if (!verifyHmac(payload, secret, hmacHeader)) {
      console.warn("[middleware][webhook][warn] HMAC verification failed");
      return c.json({ error: "Invalid HMAC signature" }, 401);
    }

    console.log(
      "[middleware][webhook] HMAC verified, proceeding to next middleware",
    );
    await next();
  })
  .post("/usage", zValidator("json", z.array(UsageEventSchema)), async (c) => {
    const body = await c.req.valid("json");
    console.log("Received usage webhook:", body);

    try {
      // Process each usage event in the array
      // Transform the incoming usage events to match the Convex mutation schema
      await fetchMutation(api.usage.mutation.trackUsage, {
        payload: body.map((event) => ({
          projectId: event.data.projectId as Id<"projects">,
          event: event.event,
          payloadLength: event.data.payloadLength,
          apiKeyId: event.data.keyId as Id<"api_keys">,
        })),
      });

      // Return success response
      return c.json({
        success: true,
        message: `Processed ${body.length} usage events successfully`,
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
  });
