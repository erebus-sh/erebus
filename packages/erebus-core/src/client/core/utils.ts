import { logger } from "@/internal/logger/consola";

export function safeJsonParse<T = unknown>(raw: string): T | null {
  try {
    const parsed = JSON.parse(raw) as T;
    logger.info("utils.safeJsonParse success");
    return parsed;
  } catch (err) {
    logger.warn("utils.safeJsonParse failed", { err });
    return null;
  }
}
