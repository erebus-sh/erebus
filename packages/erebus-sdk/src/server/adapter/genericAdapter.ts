import { createApp } from "@/server/app";
import type { ErebusSession } from "@/service/session";
import type { FireWebhookSchema } from "@repo/schemas/webhooks/fireWebhook";

export type Authorize = (
  channel: string,
  ctx: { req: Request },
) => ErebusSession | Promise<ErebusSession>;

export type FireWebhook = (webHookMessage: FireWebhookSchema) => Promise<void>;

export async function getSessionFromRequest(
  req: Request,
  authorize: Authorize,
  fireWebhook: FireWebhook,
): Promise<ErebusSession | undefined> {
  let channel = "";

  try {
    const body = (await req.clone().json()) as { channel?: unknown };
    if (typeof body.channel === "string") {
      channel = body.channel;
    }
  } catch {
    // If parsing fails, channel remains empty
  }

  // Check if this is a webhook request
  const isWebhookRequest =
    req.method === "POST" &&
    (req.url === "/api/erebus/pubsub/fire-webhook" ||
      req.url.endsWith("/api/erebus/pubsub/fire-webhook"));

  if (isWebhookRequest) {
    const webHookMessage = await req.json();
    await fireWebhook(webHookMessage);
    return undefined;
  } else {
    return await authorize(channel, { req });
  }
}

export function createAdapter({
  authorize,
  fireWebhook,
}: {
  authorize: Authorize;
  fireWebhook: FireWebhook;
}) {
  const fetch = async (req: Request): Promise<Response> => {
    const session = await getSessionFromRequest(req, authorize, fireWebhook);
    // Create a new app instance with the session injected
    const app = createApp(session);

    return await app.fetch(req);
  };

  return {
    fetch,
  };
}
