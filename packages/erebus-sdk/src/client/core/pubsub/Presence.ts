import type { PresencePacketType } from "@repo/schemas/packetEnvelope";
import { logger } from "@/internal/logger/consola";

/**
 * Handler function type for presence updates
 */
export type PresenceHandler = (presence: {
  clientId: string;
  topic: string;
  status: "online" | "offline";
  timestamp: number;
}) => void;

/**
 * Manages presence event handlers for different topics
 */
export class PresenceManager {
  #connectionId: string;
  #presenceHandlers = new Map<string, Set<PresenceHandler>>();

  constructor(connectionId: string) {
    this.#connectionId = connectionId;
    logger.info(`[${this.#connectionId}] PresenceManager created`);
  }

  /**
   * Register a presence handler for a specific topic
   * @param topic - The topic to listen for presence updates on
   * @param handler - The callback function to handle presence updates
   */
  onPresence(topic: string, handler: PresenceHandler): void {
    logger.info(`[${this.#connectionId}] Adding presence handler for topic`, {
      topic,
    });

    // Validate inputs
    if (!topic || typeof topic !== "string" || topic.trim().length === 0) {
      const error = "Invalid topic: must be a non-empty string";
      logger.error(`[${this.#connectionId}] ${error}`, { topic });
      throw new Error(error);
    }

    if (typeof handler !== "function") {
      const error = "Invalid handler: must be a function";
      logger.error(`[${this.#connectionId}] ${error}`);
      throw new Error(error);
    }

    // Initialize topic handler set if it doesn't exist
    if (!this.#presenceHandlers.has(topic)) {
      this.#presenceHandlers.set(topic, new Set());
    }

    // Add the handler
    this.#presenceHandlers.get(topic)!.add(handler);

    logger.info(`[${this.#connectionId}] Presence handler added`, {
      topic,
      totalHandlers: this.#presenceHandlers.get(topic)!.size,
    });
  }

  /**
   * Remove a presence handler for a specific topic
   * @param topic - The topic to remove the handler from
   * @param handler - The specific handler function to remove
   */
  offPresence(topic: string, handler: PresenceHandler): void {
    logger.info(`[${this.#connectionId}] Removing presence handler for topic`, {
      topic,
    });

    const handlers = this.#presenceHandlers.get(topic);
    if (!handlers) {
      logger.warn(`[${this.#connectionId}] No handlers found for topic`, {
        topic,
      });
      return;
    }

    handlers.delete(handler);

    // Clean up empty handler sets
    if (handlers.size === 0) {
      this.#presenceHandlers.delete(topic);
    }

    logger.info(`[${this.#connectionId}] Presence handler removed`, {
      topic,
      remainingHandlers: handlers.size,
    });
  }

  /**
   * Remove all presence handlers for a specific topic
   * @param topic - The topic to clear all handlers for
   */
  clearPresenceHandlers(topic: string): void {
    logger.info(
      `[${this.#connectionId}] Clearing all presence handlers for topic`,
      { topic },
    );
    this.#presenceHandlers.delete(topic);
  }

  /**
   * Remove all presence handlers for all topics
   */
  clearAllPresenceHandlers(): void {
    logger.info(`[${this.#connectionId}] Clearing all presence handlers`);
    this.#presenceHandlers.clear();
  }

  /**
   * Handle incoming presence packet
   * @param presencePacket - The presence packet received from the server
   */
  handlePresencePacket(presencePacket: PresencePacketType): void {
    logger.info(`[${this.#connectionId}] Handling presence packet`, {
      clientId: presencePacket.clientId,
      topic: presencePacket.topic,
      status: presencePacket.status,
    });

    const handlers = this.#presenceHandlers.get(presencePacket.topic);
    if (!handlers || handlers.size === 0) {
      logger.debug(
        `[${this.#connectionId}] No presence handlers found for topic`,
        {
          topic: presencePacket.topic,
        },
      );
      return;
    }

    // Create presence event data
    const presenceEvent = {
      clientId: presencePacket.clientId,
      topic: presencePacket.topic,
      status: presencePacket.status,
      timestamp: Date.now(),
    };

    // Call all handlers for this topic
    for (const handler of handlers) {
      try {
        handler(presenceEvent);
      } catch (error) {
        logger.error(`[${this.#connectionId}] Error in presence handler`, {
          error,
          topic: presencePacket.topic,
          clientId: presencePacket.clientId,
        });
        // Continue with other handlers even if one fails
      }
    }

    logger.info(
      `[${this.#connectionId}] Presence packet handled successfully`,
      {
        topic: presencePacket.topic,
        handlersCount: handlers.size,
      },
    );
  }

  /**
   * Get all topics that have presence handlers
   */
  getTopicsWithPresenceHandlers(): string[] {
    return Array.from(this.#presenceHandlers.keys());
  }

  /**
   * Get the number of presence handlers for a specific topic
   */
  getPresenceHandlerCount(topic: string): number {
    return this.#presenceHandlers.get(topic)?.size || 0;
  }

  /**
   * Get total number of presence handlers across all topics
   */
  getTotalPresenceHandlerCount(): number {
    let count = 0;
    for (const handlers of this.#presenceHandlers.values()) {
      count += handlers.size;
    }
    return count;
  }

  /**
   * Debug method to get all presence handlers
   */
  get __debugPresenceHandlers(): Map<string, Set<PresenceHandler>> {
    return new Map(this.#presenceHandlers);
  }
}
