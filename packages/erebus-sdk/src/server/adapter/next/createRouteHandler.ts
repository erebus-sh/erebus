import { handle } from "hono/vercel";
import { createApp } from "@/server/app";
import { getSessionFromRequest } from "../genericAdapter";
import type { Authorize, FireWebhook } from "../genericAdapter";

export function createRouteHandler({
  authorize,
  fireWebhook,
}: {
  authorize: Authorize<Request>;
  fireWebhook: FireWebhook;
}) {
  const createHandler = async (req: Request): Promise<Response> => {
    const session = await getSessionFromRequest(req, authorize, fireWebhook);
    // Create a new app instance with the session injected
    const app = createApp(session);

    const h = handle(app);
    return await h(req);
  };

  return {
    POST: createHandler,
  };
}
