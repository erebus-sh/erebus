import { Hono } from "hono";
import { logger } from "@/internal/logger/consola";

import { ErebusSession } from "@/service/session";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { FireWebhookSchema } from "@repo/schemas/webhooks/fireWebhook";
import { verifyHmac } from "@repo/shared/utils/hmac";

export type AppVars = {
  reqId: string;
  session?: ErebusSession;
};

type SessionProvider = (req: Request) => ErebusSession | Promise<ErebusSession>;

export function createApp(sessionOrProvider?: ErebusSession | SessionProvider) {
  const app = new Hono<{ Variables: AppVars }>();

  app.onError((err, c) => {
    logger.error("[unhandled]", {
      reqId: c.get("reqId"),
      err:
        err instanceof Error
          ? { name: err.name, message: err.message, stack: err.stack }
          : err,
      path: c.req.path,
      method: c.req.method,
    });
    return c.json({ error: "internal_error", reqId: c.get("reqId") }, 500);
  });

  app.notFound((c) => {
    return c.json(
      { error: "not_found", path: c.req.path, reqId: c.get("reqId") },
      404,
    );
  });

  app.use("*", async (c, next) => {
    /**
     * Generate a unique request id for the request to be identified by the logger
     */
    const reqId = crypto.randomUUID();
    c.set("reqId", reqId);

    /**
     * Inject session if provided
     */
    if (sessionOrProvider) {
      if (typeof sessionOrProvider === "function") {
        // It's a session provider - call it per request
        const session = await sessionOrProvider(c.req.raw);
        c.set("session", session);
      } else {
        // It's a static session (for route handler usage)
        c.set("session", sessionOrProvider);
      }
    }

    /**
     * Log the request start time
     */
    const started = performance.now();
    try {
      await next();
    } finally {
      const ms = Math.round(performance.now() - started);
      logger.info(`[${reqId}] ${c.req.method} ${c.req.path} -> ${ms}ms`);
    }
  });

  // Add the routes using the shared routes function
  return app.route("/", routes);
}

// Define routes separately for RPC type inference
const routes = new Hono<{ Variables: AppVars }>()
  /**
   * Health check route
   */
  .get("/api/health", (c) => c.json({ ok: true, reqId: c.get("reqId") }))
  /**
   * Generate a token route test
   */
  .get("/api/generate-token-test", (c) => {
    const session = c.get("session");
    if (!session) {
      return c.json(
        {
          error: "session_required, the server is not initialized properly",
          reqId: c.get("reqId"),
        },
        400,
      );
    }

    console.log(session.__debugObject);

    logger.info(`[${c.get("reqId")}] Generating token`);
    return c.json({
      token: "test",
    });
  })
  /**
   * This is the API to generate the token for the client
   * it calls Erebus service to generate the token
   */
  .post(
    "/api/erebus/pubsub/grant",
    zValidator(
      "json",
      z.object({
        channel: z.string(),
      }),
    ),
    async (c) => {
      const session = c.get("session");
      const reqId = c.get("reqId");
      logger.info(`[${reqId}] Generating token`);

      if (!session) {
        return c.json(
          {
            error: "session_required, the server is not initialized properly",
            reqId,
          },
          400,
        );
      }
      let token = ""; // default value to avoid undefined
      try {
        token = await session.authorize();
      } catch (error) {
        logger.error(
          `[${reqId}] Error generating token: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
        return c.json(
          {
            error: "error_generating_token",
            reqId,
            message: error instanceof Error ? error.message : "Unknown error",
          },
          500,
        );
      }

      return c.json({
        grant_jwt: token,
      });
    },
  )
  .post(
    "/api/erebus/pubsub/fire-webhook",
    zValidator("json", FireWebhookSchema),
    async (c) => {
      const { messageBody, hmac } = c.req.valid("json");
      const secret = process.env["WEBHOOK_SECRET"];
      if (!secret) {
        console.error(
          "[pubsub][fire-webhook] WEBHOOK_SECRET is not set please, set the secret key in the environment variables",
        );
        return c.json(
          {
            error:
              "WEBHOOK_SECRET is not set please, set the secret key in the environment variables",
          },
          500,
        );
      }
      if (!verifyHmac(JSON.stringify(messageBody), secret, hmac)) {
        console.error(
          "[pubsub][fire-webhook] Invalid HMAC please, check the HMAC is correct",
        );
        return c.json(
          {
            error: "Invalid HMAC please, check the HMAC is correct",
          },
          401,
        );
      }
      console.log(
        "[pubsub][fire-webhook] HMAC verified, proceeding to next middleware",
      );
      return c.json({
        ok: true,
      });
    },
  );

// Export the AppType for RPC client usage
export type AppType = typeof routes;

export type AuthorizeServer = (
  req: Request,
) => ErebusSession | Promise<ErebusSession>;

// export const startAuthServer = async (
//   port: number,
//   authorize: AuthorizeServer,
// ) => {
//   const app = createApp(authorize);
//   logger.info(`Attempting to start server on port ${port}...`);
//   const server = serve({
//     fetch: app.fetch,
//     port,
//   });
//   server.on("listening", () => {
//     logger.info(`Server successfully started and is running on port ${port}`);
//   });
//   server.on("error", (err: Error) => {
//     logger.error(`Server failed to start on port ${port}: ${err.message}`);
//   });
//   return server;
// };
