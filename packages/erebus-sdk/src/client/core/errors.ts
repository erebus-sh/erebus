import { logger } from "@/internal/logger/consola";

export class NotConnectedError extends Error {}
export class BackpressureError extends Error {}
export class AuthError extends Error {}

export function logError(
  err: unknown,
  context?: Record<string, unknown>,
): void {
  logger.error("client error", { err, ...(context ?? {}) });
}
