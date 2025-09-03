import { DurableObject } from "cloudflare:workers";
import { Env } from "@/env";
import { ServiceContext } from "./types";
import { ErebusClient } from "./ErebusClient";

/**
 * Abstract base class for all Erebus PubSub services.
 *
 * This class extends Cloudflare's DurableObject and provides:
 * - Common WebSocket functionality
 * - Shared logging methods with consistent prefixes
 * - Environment and context access
 * - Hibernation-compatible WebSocket handling
 *
 * All concrete PubSub implementations should extend this class.
 */
export abstract class ErebusPubSubService extends DurableObject<Env> {
  /**
   * Service context for dependency injection to child services
   */
  protected readonly serviceContext: ServiceContext;

  /**
   * Shared TextEncoder instance for efficient string encoding
   */
  protected static readonly TEXT_ENCODER = new TextEncoder();

  /**
   * Initialize the PubSub service with WebSocket auto-response for ping/pong
   *
   * @param ctx - Durable Object state context
   * @param env - Environment variables and bindings
   */
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);

    // Set up ping/pong auto-response for WebSocket keepalive
    this.ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair("ping", "pong"),
    );

    // Create service context for dependency injection
    this.serviceContext = { ctx, env };

    this.log("[CONSTRUCTOR] PubSub service instance created");
  }

  /**
   * Abstract method for handling WebSocket connection upgrades.
   * Concrete classes must implement this method.
   *
   * @param request - The incoming HTTP request for WebSocket upgrade
   * @returns Promise resolving to HTTP response with WebSocket client
   */
  abstract fetch(request: Request): Promise<Response>;

  /**
   * Abstract method for handling WebSocket messages.
   * Concrete classes must implement this method.
   *
   * @param ws - The WebSocket connection
   * @param message - The received message as string
   */
  abstract webSocketMessage(ws: WebSocket, message: string): Promise<void>;

  /**
   * Abstract method for handling WebSocket close events.
   * Concrete classes must implement this method.
   *
   * @param ws - The WebSocket connection
   * @param code - Close code
   * @param reason - Close reason
   * @param wasClean - Whether the close was clean
   */
  abstract webSocketClose(
    ws: WebSocket,
    code?: number,
    reason?: string,
    wasClean?: boolean,
  ): Promise<void>;

  /**
   * Centralized logging method with consistent prefixes and debug level handling.
   *
   * @param message - Log message to output
   * @param level - Log level ('log', 'warn', 'error')
   * @param prefix - Optional custom prefix (defaults to service name)
   */
  protected log(
    message: string,
    level: "log" | "warn" | "error" = "log",
    prefix?: string,
  ): void {
    const logPrefix = prefix || this.getServiceName();
    const fullMessage = `${logPrefix} ${message}`;

    switch (level) {
      case "warn":
        console.warn(fullMessage);
        break;
      case "error":
        console.error(fullMessage);
        break;
      default:
        console.log(fullMessage);
    }
  }

  /**
   * Debug-only logging that respects the DEBUG environment variable.
   *
   * @param message - Debug message to output
   * @param prefix - Optional custom prefix
   */
  protected logDebug(message: string, prefix?: string): void {
    if (this.env.DEBUG) {
      this.log(message, "log", prefix);
    }
  }

  /**
   * Verbose debug logging that respects the EREBUS_DEBUG_VERBOSE environment variable.
   *
   * @param message - Verbose debug message to output
   * @param prefix - Optional custom prefix
   */
  protected logVerbose(message: string, prefix?: string): void {
    if (this.env.EREBUS_DEBUG_VERBOSE) {
      this.log(message, "log", prefix);
    }
  }

  /**
   * Get the service name for logging prefixes.
   * Subclasses can override this for custom service identification.
   *
   * @returns Service name string
   */
  protected getServiceName(): string {
    return `[${this.constructor.name
      .replace(/([A-Z])/g, "_$1")
      .slice(1)
      .toUpperCase()}]`;
  }

  /**
   * Utility method to create a WebSocket pair and prepare for hibernation.
   *
   * @returns Object containing client and server WebSocket instances
   */
  protected createWebSocketPair(): { client: WebSocket; server: WebSocket } {
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    this.logDebug("[CREATE_WS_PAIR] WebSocket pair created");

    return { client, server };
  }

  /**
   * Accept a WebSocket for hibernation-compatible handling.
   *
   * @param ws - Server-side WebSocket to accept
   */
  protected acceptWebSocket(ws: WebSocket): void {
    this.ctx.acceptWebSocket(ws);
    this.logDebug("[ACCEPT_WS] WebSocket accepted for hibernation");
  }

  /**
   * Get all active WebSocket connections managed by this Durable Object.
   *
   * @returns Array of active WebSocket connections
   */
  protected getWebSockets(): WebSocket[] {
    return this.ctx.getWebSockets();
  }

  /**
   * Get all active ErebusClient connections with valid grants.
   *
   * @returns Array of ErebusClient instances (only those with valid grants)
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
   * Safely close an ErebusClient connection with proper error handling.
   *
   * @param client - ErebusClient to close
   * @param code - Close code (optional)
   * @param reason - Close reason (optional)
   */
  protected safeCloseWebSocket(
    client: ErebusClient,
    code?: number,
    reason?: string,
  ): void {
    try {
      client.close(code, reason);
      this.logDebug(
        `[CLOSE_WS] WebSocket closed (code: ${code}, reason: ${reason})`,
      );
    } catch (error) {
      this.log(`[CLOSE_WS] Error closing WebSocket: ${error}`, "warn");
    }
  }

  /**
   * Execute an operation within a Durable Object storage transaction.
   * Provides proper error handling and logging.
   *
   * @param operation - Transaction operation to execute
   * @returns Promise resolving to the operation result
   */
  protected async transaction<T>(
    operation: (txn: DurableObjectTransaction) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.ctx.storage.transaction(operation);
    } catch (error) {
      this.log(`[TRANSACTION] Transaction failed: ${error}`, "error");
      throw error;
    }
  }

  /**
   * Get a value from Durable Object storage with proper typing.
   *
   * @param key - Storage key
   * @param defaultValue - Default value if key doesn't exist
   * @returns Promise resolving to the stored value or default
   */
  protected async getStorageValue<T>(
    key: string,
    defaultValue?: T,
  ): Promise<T | undefined> {
    try {
      const value = await this.ctx.storage.get<T>(key);
      return value ?? defaultValue;
    } catch (error) {
      this.log(`[STORAGE_GET] Failed to get key '${key}': ${error}`, "warn");
      return defaultValue;
    }
  }

  /**
   * Put a value into Durable Object storage with proper error handling.
   *
   * @param key - Storage key
   * @param value - Value to store
   * @returns Promise that resolves when storage is complete
   */
  protected async putStorageValue<T>(key: string, value: T): Promise<void> {
    try {
      await this.ctx.storage.put(key, value);
    } catch (error) {
      this.log(`[STORAGE_PUT] Failed to put key '${key}': ${error}`, "error");
      throw error;
    }
  }

  /**
   * Delete a key from Durable Object storage with proper error handling.
   *
   * @param key - Storage key to delete
   * @returns Promise resolving to whether the key existed
   */
  protected async deleteStorageValue(key: string): Promise<boolean> {
    try {
      return await this.ctx.storage.delete(key);
    } catch (error) {
      this.log(
        `[STORAGE_DELETE] Failed to delete key '${key}': ${error}`,
        "error",
      );
      throw error;
    }
  }

  /**
   * List storage entries with a given prefix.
   *
   * @param options - List options (prefix, limit, etc.)
   * @returns Promise resolving to a Map of key-value pairs
   */
  protected async listStorage<T>(
    options?: DurableObjectListOptions,
  ): Promise<Map<string, T>> {
    try {
      return await this.ctx.storage.list<T>(options);
    } catch (error) {
      this.log(`[STORAGE_LIST] Failed to list storage: ${error}`, "error");
      throw error;
    }
  }
}
