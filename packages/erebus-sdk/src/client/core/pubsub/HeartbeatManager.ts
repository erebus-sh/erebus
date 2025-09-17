import { logger } from "@/internal/logger/consola";

import type { IHeartbeatManager, Logger } from "./interfaces";

/**
 * Manages heartbeat/ping functionality to keep WebSocket connections alive
 */
export class HeartbeatManager implements IHeartbeatManager {
  #connectionId: string;
  #intervalMs: number;
  #intervalId?: NodeJS.Timeout;
  #sendHeartbeat: () => void;
  #log: Logger;

  constructor(
    connectionId: string,
    intervalMs: number,
    sendHeartbeat: () => void,
    log: Logger,
  ) {
    this.#connectionId = connectionId;
    this.#intervalMs = intervalMs;
    this.#sendHeartbeat = sendHeartbeat;
    this.#log = log;
    logger.info(`[${this.#connectionId}] HeartbeatManager created`, {
      intervalMs,
    });
  }

  get isRunning(): boolean {
    return this.#intervalId !== undefined;
  }

  start(): void {
    logger.info(`[${this.#connectionId}] Starting heartbeat`, {
      intervalMs: this.#intervalMs,
    });

    // Stop any existing heartbeat first
    this.stop();

    this.#intervalId = setInterval(() => {
      try {
        /**
         * Heartbeats are just a ping string, not a packet envelope
         * it gets an auto response `pong` from the cloudflare gateway if it's still alive
         */
        this.#log("info", "sending heartbeat ping");
        logger.info(`[${this.#connectionId}] Sending heartbeat ping`);
        this.#sendHeartbeat();
      } catch (error) {
        logger.error(`[${this.#connectionId}] Error sending heartbeat`, {
          error,
        });
        // The error will be handled by the caller (typically the connection manager)
        throw error;
      }
    }, this.#intervalMs);

    logger.info(`[${this.#connectionId}] Heartbeat started successfully`);
  }

  stop(): void {
    if (this.#intervalId) {
      logger.info(`[${this.#connectionId}] Stopping heartbeat`);
      clearInterval(this.#intervalId);
      this.#intervalId = undefined;
    } else {
      logger.debug(`[${this.#connectionId}] No heartbeat to stop`);
    }
  }

  /**
   * Update the heartbeat interval (requires restart if running)
   */
  setInterval(intervalMs: number): void {
    logger.info(`[${this.#connectionId}] Updating heartbeat interval`, {
      oldInterval: this.#intervalMs,
      newInterval: intervalMs,
    });

    const wasRunning = this.isRunning;
    this.stop();
    this.#intervalMs = intervalMs;

    if (wasRunning) {
      this.start();
    }
  }

  /**
   * Get current heartbeat interval
   */
  getInterval(): number {
    return this.#intervalMs;
  }
}
