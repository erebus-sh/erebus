import type { IGrantManager, TokenProvider } from "./interfaces";
import { logger } from "@/internal/logger/consola";

const GRANT_CACHE_KEY = "erebus:grant";

// Helper function to safely log sensitive data
function logSensitiveData(data: string, prefix: string = "data"): string {
  if (!data || data.length < 8) return `${prefix}: [too short]`;
  return `${prefix}: ${data.substring(0, 4)}...${data.substring(data.length - 4)}`;
}

/**
 * Manages grant/token caching and retrieval
 */
export class GrantManager implements IGrantManager {
  #connectionId: string;
  #tokenProvider: TokenProvider;

  constructor(connectionId: string, tokenProvider: TokenProvider) {
    this.#connectionId = connectionId;
    this.#tokenProvider = tokenProvider;
    logger.info(`[${this.#connectionId}] GrantManager created`);
  }

  getCachedGrant(): string | undefined {
    logger.info(`[${this.#connectionId}] Attempting to get cached grant`);
    try {
      // Only in browser environments
      if (typeof localStorage !== "undefined") {
        const v = localStorage.getItem(GRANT_CACHE_KEY);
        if (v) {
          logger.info(`[${this.#connectionId}] Cached grant found`, {
            grantPreview: logSensitiveData(v, "cached_grant"),
          });
        } else {
          logger.info(`[${this.#connectionId}] No cached grant found`);
        }
        return v ?? undefined;
      } else {
        logger.info(
          `[${this.#connectionId}] localStorage not available (non-browser environment)`,
        );
      }
    } catch (error) {
      logger.warn(`[${this.#connectionId}] Error accessing cached grant`, {
        error,
      });
      // ignore storage access errors (Safari ITP, quota, etc.)
    }
    return undefined;
  }

  setCachedGrant(token: string): void {
    logger.info(`[${this.#connectionId}] Setting cached grant`, {
      grantPreview: logSensitiveData(token, "grant_to_cache"),
    });
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(GRANT_CACHE_KEY, token);
        logger.info(`[${this.#connectionId}] Grant cached successfully`);
      } else {
        logger.info(
          `[${this.#connectionId}] Cannot cache grant - localStorage not available`,
        );
      }
    } catch (error) {
      logger.warn(`[${this.#connectionId}] Error caching grant`, { error });
      // ignore
    }
  }

  clearCachedGrant(): void {
    logger.info(`[${this.#connectionId}] Clearing cached grant`);
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(GRANT_CACHE_KEY);
        logger.info(
          `[${this.#connectionId}] Cached grant cleared successfully`,
        );
      } else {
        logger.info(
          `[${this.#connectionId}] Cannot clear grant - localStorage not available`,
        );
      }
    } catch (error) {
      logger.warn(`[${this.#connectionId}] Error clearing cached grant`, {
        error,
      });
      // ignore
    }
  }

  async getToken(channel: string): Promise<string> {
    logger.info(`[${this.#connectionId}] Getting token from provider`, {
      channel,
    });
    try {
      const token = await this.#tokenProvider(channel);
      if (!token) {
        logger.error(
          `[${this.#connectionId}] No token provided by token provider`,
        );
        throw new Error("No token provided");
      }
      logger.info(`[${this.#connectionId}] Token received`, {
        tokenPreview: logSensitiveData(token, "token"),
        channel,
      });
      return token;
    } catch (error) {
      logger.error(
        `[${this.#connectionId}] Error getting token from provider`,
        { error, channel },
      );
      throw error;
    }
  }

  /**
   * Get token with caching logic
   */
  async getTokenWithCache(channel: string): Promise<string> {
    // Always try to get a fresh token from the provider first
    // The provider will handle its own caching logic (external cache)
    logger.info(`[${this.#connectionId}] Requesting token from provider`, {
      channel,
    });
    const fresh = await this.getToken(channel);
    if (fresh) {
      logger.info(`[${this.#connectionId}] Token received from provider`);
      // Cache it internally as well for redundancy
      this.setCachedGrant(fresh);
    }
    return fresh;
  }
}
