import type { Env } from "@/env";
import type { QueueEnvelope } from "@repo/schemas/queueEnvelope";
import { ErebusClient } from "./ErebusClient";
import type { ServiceContext } from "./types";

/**
 * Logger interface for consistent logging across all managers.
 */
export interface Logger {
  debug(message: string): void;
  verbose(message: string): void;
  error(message: string): void;
  warn(message: string): void;
}

/**
 * Create a logger scoped to a service name.
 *
 * Fixes the bug in the old BaseService where logVerbose incorrectly
 * checked env.DEBUG instead of env.EREBUS_DEBUG_VERBOSE.
 */
export function createLogger(serviceName: string, env: Env): Logger {
  return {
    debug(message: string): void {
      if (env.DEBUG) {
        console.log(`${serviceName} ${message}`);
      }
    },
    verbose(message: string): void {
      if (env.EREBUS_DEBUG_VERBOSE) {
        console.log(`${serviceName} ${message}`);
      }
    },
    error(message: string): void {
      console.error(`${serviceName} ${message}`);
    },
    warn(message: string): void {
      console.warn(`${serviceName} ${message}`);
    },
  };
}

// ── Storage utilities ─────────────────────────────────────────────────

/**
 * Get a value from Durable Object storage with proper typing.
 */
export async function getStorageValue<T>(
  ctx: DurableObjectState,
  key: string,
  defaultValue?: T,
): Promise<T | undefined> {
  try {
    const value = await ctx.storage.get<T>(key);
    return value ?? defaultValue;
  } catch {
    return defaultValue;
  }
}

/**
 * Put a value into Durable Object storage.
 */
export async function putStorageValue<T>(
  ctx: DurableObjectState,
  key: string,
  value: T,
): Promise<void> {
  await ctx.storage.put(key, value);
}

/**
 * Delete a key from Durable Object storage.
 */
export async function deleteStorageValue(
  ctx: DurableObjectState,
  key: string,
): Promise<boolean> {
  return await ctx.storage.delete(key);
}

/**
 * List storage entries with a given prefix.
 */
export async function listStorage<T>(
  ctx: DurableObjectState,
  options?: DurableObjectListOptions,
): Promise<Map<string, T>> {
  return await ctx.storage.list<T>(options);
}

/**
 * Batch put multiple key-value pairs to storage.
 * Cloudflare supports up to 128 keys per batch.
 */
export async function batchPutStorage(
  ctx: DurableObjectState,
  entries: Record<string, unknown>,
): Promise<void> {
  await ctx.storage.put(entries);
}

/**
 * Batch delete multiple keys from storage.
 * Cloudflare supports up to 128 keys per batch.
 */
export async function batchDeleteStorage(
  ctx: DurableObjectState,
  keys: string[],
): Promise<number> {
  if (keys.length === 0) return 0;
  return await ctx.storage.delete(keys);
}

// ── Client utilities ──────────────────────────────────────────────────

/**
 * Get all active ErebusClient connections with valid grants.
 */
export function getErebusClients(ctx: DurableObjectState): ErebusClient[] {
  const sockets = ctx.getWebSockets();
  const clients: ErebusClient[] = [];
  for (const socket of sockets) {
    const client = ErebusClient.fromWebSocket(socket);
    if (client) {
      clients.push(client);
    }
  }
  return clients;
}

// ── Queue utilities ───────────────────────────────────────────────────

/**
 * Enqueue a usage tracking event.
 */
export async function enqueueUsageEvent(
  env: Env,
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
    await env.EREBUS_QUEUE.send(usageEnvelope);
  } catch {
    // Usage tracking failures should not break the main flow
  }
}
