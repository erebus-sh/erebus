import { createApp } from "@/server/app";
import type { ErebusSession } from "@/service/session";
import type { FireWebhookSchema } from "@repo/schemas/webhooks/fireWebhook";

export type Authorize<T = Request> = (
  channel: string,
  ctx: { req: T },
) => ErebusSession | Promise<ErebusSession>;

export type FireWebhook = (webHookMessage: FireWebhookSchema) => Promise<void>;

export async function getSessionFromRequest<T = Request>(
  req: T,
  authorize: Authorize<T>,
  fireWebhook: FireWebhook,
): Promise<ErebusSession | undefined> {
  let channel = "";

  // Type-safe way to handle different request types
  const requestLike = req as Request;

  try {
    const body = (await requestLike.clone().json()) as { channel?: unknown };
    if (typeof body.channel === "string") {
      channel = body.channel;
    }
  } catch {
    // If parsing fails, channel remains empty
  }

  if (
    requestLike.method === "POST" &&
    requestLike.url === "/api/erebus/pubsub/fire-webhook"
  ) {
    const webHookMessage = await requestLike.json();
    await fireWebhook(webHookMessage);
    return undefined;
  } else {
    return await authorize(channel, { req });
  }
}

export function createGenericAdapter<T = Request>({
  authorize,
  fireWebhook,
}: {
  authorize: Authorize<T>;
  fireWebhook: FireWebhook;
}) {
  const fetch = async (req: T): Promise<Response> => {
    const session = await getSessionFromRequest(req, authorize, fireWebhook);
    // Create a new app instance with the session injected
    const app = createApp(session);

    return await app.fetch(req as Request);
  };

  return {
    fetch,
  };
}
