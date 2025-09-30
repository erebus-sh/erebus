import { getLocationHint } from "./lib/location_hint";
import { RootCommandSchema } from "@repo/schemas/rootCommands";
import { pubsub } from "./handlers/pubsub";
import { Env } from "./env";
import { ChannelV1 } from "./objects/pubsub/channel";
import { HandlerProps } from "./types/handlerProps";
import { QueueEnvelopeSchema } from "@repo/schemas/queueEnvelope";
import { UsageWebhook } from "./services/webhooks/usage";
import { UsagePayload } from "@repo/schemas/webhooks/usageRequest";
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { validator } from "hono/validator";
import { nanoid } from "nanoid";
import { pauseProjectId, unpauseProjectId } from "./handlers/commands";

// API version configuration
const API_VERSION = "v1";
const API_BASE_PATH = `/${API_VERSION}`;

// Define the Hono app with proper Cloudflare types
type HonoVariables = {
  requestId: string;
  locationHint: DurableObjectLocationHint;
  cf: IncomingRequestCfProperties;
};

const app = new Hono<{
  Bindings: Env;
  Variables: HonoVariables;
}>();

// Middleware to add request ID to every request
const requestIdMiddleware = createMiddleware<{
  Bindings: Env;
  Variables: HonoVariables;
}>(async (c, next) => {
  const requestId = nanoid();
  c.set("requestId", requestId);
  await next();
});

// Middleware for comprehensive logging and location hint extraction
const loggingMiddleware = createMiddleware<{
  Bindings: Env;
  Variables: HonoVariables;
}>(async (c, next) => {
  const request = c.req.raw;
  const { cf } = request;
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  const upgrade = request.headers.get("upgrade");
  const requestId = c.get("requestId");

  const continentCode = cf?.continent as ContinentCode | undefined;
  const latitude = Number(cf?.latitude);
  const longitude = Number(cf?.longitude);

  // Store cf properties for later use
  c.set("cf", cf as IncomingRequestCfProperties);

  // Calculate location hint
  const hasPoint = !Number.isNaN(latitude) && !Number.isNaN(longitude);
  const locationHint = getLocationHint({
    continentCode,
    point: hasPoint ? { lat: latitude, lon: longitude } : undefined,
  });
  c.set("locationHint", locationHint);

  // Comprehensive log of request details
  console.log(`[FETCH] [${requestId}] Incoming request details:`, {
    url: request.url,
    path,
    method,
    upgrade,
    headers: Object.fromEntries(request.headers.entries()),
    cf: {
      continent: continentCode,
      latitude: cf?.latitude,
      longitude: cf?.longitude,
      country: cf?.country,
      region: cf?.region,
      city: cf?.city,
      colo: cf?.colo,
      timezone: cf?.timezone,
      postalCode: cf?.postalCode,
      metroCode: cf?.metroCode,
      regionCode: cf?.regionCode,
      asOrganization: cf?.asOrganization,
      asn: cf?.asn,
      clientTcpRtt: cf?.clientTcpRtt,
      requestPriority: cf?.requestPriority,
      tlsCipher: cf?.tlsCipher,
      tlsClientAuth: cf?.tlsClientAuth,
      tlsVersion: cf?.tlsVersion,
      edgeRequestKeepAliveStatus: cf?.edgeRequestKeepAliveStatus,
    },
    parsed: {
      continentCode,
      latitude,
      longitude,
    },
    locationHint,
    timestamp: new Date().toISOString(),
  });

  await next();
});

// Apply middlewares globally
app.use("*", requestIdMiddleware);
app.use("*", loggingMiddleware);

// Create a scoped router for versioned routes
const apiRouter = new Hono<{
  Bindings: Env;
  Variables: HonoVariables;
}>();

// Route: POST /root/command - Webhook from server to Durable Object
apiRouter.post(
  "/root/command",
  validator("json", (value) => RootCommandSchema.parse(value)),
  async (c) => {
    const rootApiKey = c.req.header("x-root-api-key");
    const requestId = c.get("requestId");

    if (!rootApiKey) {
      console.log(
        `[${requestId}] Authentication failed: No root API key provided`,
      );
      return c.json(
        {
          error: "Authentication required: Root API key must be provided",
        },
        401,
      );
    }

    if (rootApiKey !== c.env.ROOT_API_KEY) {
      console.log(
        `[${requestId}] Authentication failed: Invalid root API key provided`,
      );
      return c.json(
        {
          error: "Authentication failed: Invalid root API key provided",
        },
        401,
      );
    }

    const command = c.req.valid("json");
    /**
     * Use getChannelsForProjectId to get all the channels for the project id
     */
    switch (command.command) {
      /**
       * when usage limits hit, we pause it by call stub in every avaliable
       * do instance, they are all stored in redis, so we can just grab them
       * and loop on them
       */
      case "pause_project_id":
        await pauseProjectId({
          projectId: command.projectId,
          env: c.env,
        });
      case "unpause_project_id":
        await unpauseProjectId({
          projectId: command.projectId,
          env: c.env,
        });
      default:
        console.log(
          `[${requestId}] Unsupported command type:`,
          command.command,
        );
        return c.json(
          {
            error: "Invalid request: Unsupported command type",
          },
          400,
        );
    }
  },
);

// Route: WebSocket upgrade for /pubsub/*
apiRouter.get("/pubsub/*", async (c) => {
  const request = c.req.raw;
  const upgrade = request.headers.get("upgrade");
  const requestId = c.get("requestId");

  if (upgrade !== "websocket") {
    console.log(
      `[${requestId}] WebSocket upgrade required for /${API_VERSION}/pubsub`,
    );
    return c.json(
      {
        error: "WebSocket upgrade required for this service",
      },
      400,
    );
  }

  const handlerProps: HandlerProps = {
    request,
    env: c.env,
    locationHint: c.get("locationHint"),
  };

  console.log(`[${requestId}] Routing to pubsub handler`);
  return await pubsub(handlerProps);
});

// Route: WebSocket upgrade for /state/*
apiRouter.get("/state/*", async (c) => {
  const request = c.req.raw;
  const upgrade = request.headers.get("upgrade");
  const requestId = c.get("requestId");

  if (upgrade !== "websocket") {
    console.log(
      `[${requestId}] WebSocket upgrade required for /${API_VERSION}/state`,
    );
    return c.json(
      {
        error: "WebSocket upgrade required for this service",
      },
      400,
    );
  }

  console.log(`[${requestId}] /${API_VERSION}/state/ not implemented yet`);
  throw new Error("Not implemented /" + API_VERSION + "/state/");
});

// Mount the versioned API router
app.route(API_BASE_PATH, apiRouter);

// 404 handler for all unmatched routes — Erebus Gateway
app.notFound((c) => {
  const requestId = c.get("requestId");
  const method = c.req.method;
  const path = c.req.path;
  console.warn(
    `[${requestId}] [Erebus Gateway] Attempted access to unknown endpoint: ${method} ${path}`,
  );
  return c.json(
    {
      error:
        "Erebus Gateway: The endpoint you requested does not exist. Please check your URL or consult the Erebus API documentation for available endpoints.",
      docs: "https://docs.erebus.sh/",
      requestId,
    },
    404,
  );
});

// Error handler
app.onError((err, c) => {
  const requestId = c.get("requestId");
  console.error(`[${requestId}] Unhandled error:`, err);
  return c.json({ error: "Internal server error" }, 500);
});

export default {
  /**
   * WebSocket service handler for real-time communication using Hono.
   *
   * This handler only manages WebSocket connections. All user-related logic—
   * such as authentication or database interactions—
   * must be handled via the JWT passed to the service or through webhooks.
   * Usage tracking is handled by queue.
   *
   * @param request - Incoming client request
   * @param env - Environment bindings from wrangler.jsonc
   * @param ctx - Execution context
   * @returns Response to establish or reject the WebSocket connection
   */
  fetch: app.fetch.bind(app),

  /**
   * This queue is now only used for webhooks, there is multiple type of envelopes
   * e.g. usage, etc. It get processed by the queue consumer or actually just forwarded to the erebus server.
   *
   * @param batch
   * @param env
   */
  async queue(batch: MessageBatch, env: Env): Promise<void> {
    // Collect all usage events
    const usageEvents: UsagePayload[] = [];

    for (const msg of batch.messages) {
      const envelope = QueueEnvelopeSchema.safeParse(msg.body);
      if (!envelope.success) {
        throw new Error("Invalid queue envelope format");
      }
      const queueEnvelope = envelope.data;

      switch (queueEnvelope.packetType) {
        case "usage":
          usageEvents.push(queueEnvelope.payload);
          break;
        default:
          throw new Error("Unsupported queue envelope type");
      }
      msg.ack();
    }

    if (usageEvents.length > 0) {
      const usageWebhook = new UsageWebhook(env.WEBHOOK_BASE_URL, env);
      await usageWebhook.send(usageEvents);
      for (const event of usageEvents) {
        console.log(
          `[QUEUE] Sent usage webhook for project ${event.data.projectId}: ${event.data.payloadLength} bytes`,
        );
      }
    }
  },
} satisfies ExportedHandler<Env>;

export { ChannelV1 };

// * TODO: Later as a very strict check, call the stub to give you extact location
