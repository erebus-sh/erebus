import { handle } from "hono/vercel";
import { createApp } from "@/server/app";
import type { ErebusSession } from "@/service/session";

export type Authorize = (
  channel: string,
  ctx?: { req: Request },
) => ErebusSession | Promise<ErebusSession>;

export function createRouteHandler({ authorize }: { authorize: Authorize }) {
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

    const session = await authorize(channel, { req });

    // Create a new app instance with the session injected
    const app = createApp(session);

    const h = handle(app);
    return await h(req);
  };

  return {
    POST: createHandler,
  };
}
