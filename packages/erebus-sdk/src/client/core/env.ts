import { logger } from "@/internal/logger/consola";

export function isBrowser(): boolean {
  const hasWindow = typeof (globalThis as any).window !== "undefined"; // eslint-disable-line
  const hasDocument = typeof (globalThis as any).document !== "undefined"; // eslint-disable-line
  const result = hasWindow && hasDocument;
  logger.info("env.isBrowser evaluated", { result });
  return result;
}

export function isProd(): boolean {
  try {
    const prod =
      typeof process !== "undefined" && process.env?.NODE_ENV === "production";
    logger.info("env.isProd evaluated", { prod });
    return prod;
  } catch (err) {
    logger.warn("env.isProd error", { err });
    return false;
  }
}
