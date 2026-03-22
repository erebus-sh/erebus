import { DurableObject } from "cloudflare:workers";
import type { Env } from "@/env";
import type { ServiceContext } from "./types";
import { ErebusClient } from "./ErebusClient";

/**
 * Abstract base class for Erebus PubSub Durable Objects.
 *
 * Provides only what the DurableObject layer needs:
 * - WebSocket pair creation and hibernation-compatible acceptance
 * - Service context for dependency injection to managers
 * - Ping/pong auto-response for keepalive
 *
 * All storage, logging, ACK, and queue utilities have been extracted
 * to service-utils.ts and ack-utils.ts for use via composition.
 */
export abstract class ErebusPubSubService extends DurableObject<Env> {
  protected readonly serviceContext: ServiceContext;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);

    // Set up ping/pong auto-response for WebSocket keepalive
    this.ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair("ping", "pong"),
    );

    this.serviceContext = { ctx, env };
  }

  abstract fetch(request: Request): Promise<Response>;
  abstract webSocketMessage(ws: WebSocket, message: string): Promise<void>;
  abstract webSocketClose(
    ws: WebSocket,
    code?: number,
    reason?: string,
    wasClean?: boolean,
  ): Promise<void>;

  /**
   * Create a WebSocket pair for hibernation-compatible handling.
   */
  protected createWebSocketPair(): { client: WebSocket; server: WebSocket } {
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);
    return { client, server };
  }

  /**
   * Accept a WebSocket for hibernation-compatible handling.
   */
  protected acceptWebSocket(ws: WebSocket): void {
    this.ctx.acceptWebSocket(ws);
  }

  /**
   * Get all active WebSocket connections.
   */
  protected getWebSockets(): WebSocket[] {
    return this.ctx.getWebSockets();
  }

  /**
   * Get all active ErebusClient connections with valid grants.
   */
  protected getErebusClients(): ErebusClient[] {
    const sockets = this.getWebSockets();
    const clients: ErebusClient[] = [];
    for (const socket of sockets) {
      const client = ErebusClient.fromWebSocket(socket);
      if (client) {
        clients.push(client);
      }
    }
    return clients;
  }

  /**
   * Safely close an ErebusClient connection.
   */
  protected safeCloseWebSocket(
    client: ErebusClient,
    code?: number,
    reason?: string,
  ): void {
    try {
      client.close(code, reason);
    } catch {
      // Ignore close errors
    }
  }
}
