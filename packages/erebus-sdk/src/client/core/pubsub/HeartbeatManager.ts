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
    console.log(`[${this.#connectionId}] HeartbeatManager created`, {
      intervalMs,
    });
  }

  get isRunning(): boolean {
    return this.#intervalId !== undefined;
  }

  start(): void {
    console.log(`[${this.#connectionId}] Starting heartbeat`, {
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
        console.log(`[${this.#connectionId}] Sending heartbeat ping`);
        this.#sendHeartbeat();
      } catch (error) {
        console.error(`[${this.#connectionId}] Error sending heartbeat`, {
          error,
        });
        // The error will be handled by the caller (typically the connection manager)
        throw error;
      }
    }, this.#intervalMs);

    console.log(`[${this.#connectionId}] Heartbeat started successfully`);
  }

  stop(): void {
    if (this.#intervalId) {
      console.log(`[${this.#connectionId}] Stopping heartbeat`);
      clearInterval(this.#intervalId);
      this.#intervalId = undefined;
    } else {
      console.log(`[${this.#connectionId}] No heartbeat to stop`);
    }
  }

  /**
   * Update the heartbeat interval (requires restart if running)
   */
  setInterval(intervalMs: number): void {
    console.log(`[${this.#connectionId}] Updating heartbeat interval`, {
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
