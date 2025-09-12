import { handle } from "hono/vercel";
import { createApp } from "@/server/app";
import type { ErebusSession } from "@/service/session";
import type { FireWebhookSchema } from "@repo/schemas/webhooks/fireWebhook";

export type Authorize = (
  channel: string,
  ctx?: { req: Request },
) => ErebusSession | Promise<ErebusSession>;

export type FireWebhook = (webHookMessage: FireWebhookSchema) => Promise<void>;

export function createRouteHandler({
  authorize,
  fireWebhook,
}: {
  authorize: Authorize;
  fireWebhook: FireWebhook;
}) {
  const createHandler = async (req: Request): Promise<Response> => {
    let channel = "";

    try {
      const body = (await req.clone().json()) as { channel?: unknown };
      if (typeof body.channel === "string") {
        channel = body.channel;
      }
    } catch {
      // If parsing fails, channel remains empty
    }

    let session: ErebusSession | undefined;
    if (req.method === "POST" && req.url === "/api/pubsub/fire-webhook") {
      const webHookMessage = await req.json();
      await fireWebhook(webHookMessage);
    } else {
      session = await authorize(channel, { req });
    }
    // Create a new app instance with the session injected
    const app = createApp(session);

    const h = handle(app);
    return await h(req);
  };

  return {
    POST: createHandler,
  };
}
