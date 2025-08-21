import { getLocationHint } from "./lib/location_hint";
import { RootCommandSchema } from "schemas/rootCommands";
import { pubsub } from "./handlers/pubsub";
import { Env } from "./env";
import { ChannelV1 } from "./objects/pubsub/channel";
import { HandlerProps } from "./types/handlerProps";
import { QueueEnvelopeSchema } from "schemas/queueEnvelope";

export default {
  /**
   * WebSocket service handler for real-time communication.
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
  async fetch(request, env, ctx): Promise<Response> {
    /**
     * Extract general request information.
     */
    const { cf } = request;
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const upgrade = request.headers.get("upgrade");

    const continentCode = cf?.continent;
    const latitude = Number(cf?.latitude);
    const longitude = Number(cf?.longitude);

    /**
     * Locations
     *
     *	wnam	Western North America
     *	enam	Eastern North America
     *	sam		South America 2
     *	weur	Western Europe
     *	eeur	Eastern Europe
     *	apac	Asia-Pacific
     *	oc		Oceania
     *	afr		Africa 2
     *	me		Middle East 2
     */
    const hasPoint = !Number.isNaN(latitude) && !Number.isNaN(longitude);
    const locationHint = getLocationHint({
      continentCode,
      point: hasPoint ? { lat: latitude, lon: longitude } : undefined,
    });

    /**
     * If the request is POST and the path starts with /v1/root/command, it's means it's a webhook from the server to Durable Object.
     * We need to handle it here.
     */
    if (method === "POST" && path === "/v1/root/command") {
      const rootApiKey = request.headers.get("x-root-api-key");
      if (!rootApiKey) {
        return new Response(
          JSON.stringify({
            error: "Unauthorized you must provide a root api key",
          }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      if (rootApiKey !== env.ROOT_API_KEY) {
        return new Response(
          JSON.stringify({
            error: "Unauthorized you must provide a valid root api key",
          }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      const command = RootCommandSchema.safeParse(await request.json());
      if (!command.success) {
        return new Response(
          JSON.stringify({
            error: "Unauthorized you must provide a valid command",
          }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      /**
       * Use getChannelsForProjectId to get all the channels for the project id
       */
      switch (command.data.command) {
        case "pause_project_id":
          throw new Error("Not implemented");
        case "unpause_project_id":
          throw new Error("Not implemented");
        default:
          return new Response(
            JSON.stringify({
              error: "Unauthorized you must provide a valid command",
            }),
            {
              status: 401,
              headers: { "Content-Type": "application/json" },
            },
          );
      }
    }

    /**
     * The RFC State that every WebSocket connection [Opening Handshake](https://datatracker.ietf.org/doc/html/rfc6455#section-1.3)
     * starts with a GET request and an upgrade header.
     */
    if (method !== "GET") {
      // Explicitly guard the method so POST /v1/pubsub (or anything else) doesn't reach the DO
      return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
        status: 405,
        headers: {
          Allow: "GET",
          "Content-Type": "application/json",
        },
      });
    }
    if (upgrade !== "websocket") {
      return new Response(
        JSON.stringify({ error: "Erebus service expects a WebSocket request" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    /**
     *
     * Here we choose our gateway to the real-time layer.
     */
    const handlerProps: HandlerProps = {
      request,
      env,
      locationHint,
    };
    if (path.startsWith("/v1/pubsub/") || path.startsWith("/v1/pubsub")) {
      return await pubsub(handlerProps);
    } else if (path.startsWith("/v1/state/") || path.startsWith("/v1/state")) {
      throw new Error("Not implemented /v1/state/");
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  },

  /**
   * This queue is now only used for webhooks, there is multiple type of envelopes
   * e.g. usage, etc. It get processed by the queue consumer or actually just forwarded to the erebus server.
   *
   * @param batch
   * @param env
   */
  async queue(batch: MessageBatch, env: Env): Promise<void> {
    for (const msg of batch.messages) {
      const envelope = QueueEnvelopeSchema.safeParse(msg.body);
      if (!envelope.success) {
        throw new Error("Invalid queue envelope");
      }
      const queueEnvelope = envelope.data;

      switch (queueEnvelope.packetType) {
        case "usage":
          throw new Error("Not implemented");
          break;
        default:
          throw new Error("Invalid queue envelope");
      }
      msg.ack();
    }
  },
} satisfies ExportedHandler<Env>;

export { ChannelV1 };

// * TODO: Later as a very strict check, call the stub to give you extact location
