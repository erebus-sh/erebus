import { ServiceContext } from "./types";
import { Env } from "@/env";
import { AckPacketType } from "@repo/schemas/packetEnvelope";
import { QueueEnvelope } from "@repo/schemas/queueEnvelope";

/**
 * Base class for all PubSub services providing common functionality.
 *
 * This class provides:
 * - Storage operations with consistent error handling
 * - Logging methods with debug level handling
 * - Transaction support
 * - Service name generation for consistent prefixes
 */
export abstract class BaseService {
  protected readonly ctx: DurableObjectState;
  protected readonly env: Env;

  /**
   * Initialize the base service with context.
   *
   * @param serviceContext - Service context containing DO state and environment
   */
  constructor(protected readonly serviceContext: ServiceContext) {
    this.ctx = serviceContext.ctx;
    this.env = serviceContext.env;
  }

  /**
   * Get the service name for logging prefixes.
   * Subclasses should override this for custom service identification.
   *
   * @returns Service name string
   */
  protected abstract getServiceName(): string;

  /**
   * Execute an operation within a Durable Object storage transaction.
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
      this.logError(`[TRANSACTION] Transaction failed: ${error}`);
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
      this.logError(`[STORAGE_GET] Failed to get key '${key}': ${error}`);
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
      this.logError(`[STORAGE_PUT] Failed to put key '${key}': ${error}`);
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
      this.logError(`[STORAGE_DELETE] Failed to delete key '${key}': ${error}`);
      return false;
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
      this.logError(`[STORAGE_LIST] Failed to list storage: ${error}`);
      throw error;
    }
  }

  /**
   * Debug-only logging that respects the DEBUG environment variable.
   *
   * @param message - Debug message to output
   */
  protected logDebug(message: string): void {
    if (this.env.DEBUG) {
      console.log(`${this.getServiceName()} ${message}`);
    }
  }

  /**
   * Verbose debug logging that respects the EREBUS_DEBUG_VERBOSE environment variable.
   *
   * @param message - Verbose debug message to output
   */
  protected logVerbose(message: string): void {
    if (this.env.DEBUG) {
      console.log(`${this.getServiceName()} ${message}`);
    }
  }

  /**
   * Error logging with service prefix.
   *
   * @param message - Error message to output
   */
  protected logError(message: string): void {
    console.error(`${this.getServiceName()} ${message}`);
  }

  /**
   * Warning logging with service prefix.
   *
   * @param message - Warning message to output
   */
  protected logWarn(message: string): void {
    console.warn(`${this.getServiceName()} ${message}`);
  }

  /**
   * Send an ACK packet to a WebSocket connection.
   *
   * @param ws - WebSocket connection to send ACK to
   * @param ackPacket - Complete ACK packet
   */
  protected async sendAck(
    ws: WebSocket,
    ackPacket: AckPacketType,
  ): Promise<void> {
    try {
      if (ws.readyState === WebSocket.READY_STATE_OPEN) {
        ws.send(JSON.stringify(ackPacket));
        this.logDebug(`[SEND_ACK] ACK sent for path: ${ackPacket.type.path}`);
      }
    } catch (error) {
      this.logError(`[SEND_ACK] Failed to send ACK: ${error}`);
    }
  }

  /**
   * Create a publish success ACK.
   */
  protected createPublishSuccessAck(
    topic: string,
    serverMsgId: string,
    clientMsgId: string,
    seq: string,
    tIngress: number,
  ): AckPacketType {
    return {
      packetType: "ack",
      clientMsgId,
      type: {
        type: "ack",
        path: "publish",
        seq,
        serverAssignedId: serverMsgId,
        clientMsgId,
        topic,
        result: {
          ok: true,
          t_ingress: tIngress,
        },
      },
    };
  }

  /**
   * Create a publish error ACK.
   */
  protected createPublishErrorAck(
    topic: string,
    clientMsgId: string,
    code:
      | "UNAUTHORIZED"
      | "FORBIDDEN"
      | "INVALID"
      | "RATE_LIMITED"
      | "INTERNAL",
    message: string,
  ): AckPacketType {
    return {
      packetType: "ack",
      clientMsgId,
      type: {
        type: "ack",
        path: "publish",
        seq: "0",
        serverAssignedId: crypto.randomUUID(),
        clientMsgId,
        topic,
        result: {
          ok: false,
          code,
          message,
        },
      },
    };
  }

  /**
   * Create a subscription ACK.
   */
  protected createSubscriptionAck(
    requestId: string | undefined,
    topic: string,
    status: "subscribed" | "unsubscribed",
    path: "subscribe" | "unsubscribe",
  ): AckPacketType {
    return {
      packetType: "ack",
      clientMsgId: requestId,
      type: {
        type: "ack",
        path,
        seq: crypto.randomUUID(),
        serverAssignedId: crypto.randomUUID(),
        clientMsgId: requestId || crypto.randomUUID(),
        topic,
        result: {
          ok: true,
          status,
        },
      },
    };
  }

  /**
   * Enqueue usage tracking event to the queue.
   *
   * @param event - The usage event type
   * @param projectId - Project identifier
   * @param keyId - API key identifier
   * @param payloadLength - Length of the payload (defaults to 0)
   */
  protected async enqueueUsageEvent(
    event: "websocket.connect" | "websocket.subscribe" | "websocket.message",
    projectId: string,
    keyId: string,
    payloadLength: number = 0,
  ): Promise<void> {
    const usageEnvelope: QueueEnvelope = {
      packetType: "usage",
      payload: {
        event,
        data: {
          projectId,
          keyId,
          payloadLength,
        },
      },
    };

    try {
      await this.env.EREBUS_QUEUE.send(usageEnvelope);
      this.logDebug(
        `[USAGE_ENQUEUE] Enqueued ${event} event for project ${projectId}`,
      );
    } catch (error) {
      this.logError(
        `[USAGE_ENQUEUE] Failed to enqueue ${event} event: ${error}`,
      );
    }
  }
}
