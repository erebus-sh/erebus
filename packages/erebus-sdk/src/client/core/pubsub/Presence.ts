import type { PresencePacketType } from "@repo/schemas/packetEnvelope";

import type { Presence } from "@/client/core/types";

/**
 * Handler function type for presence updates
 */
export type PresenceHandler = (presence: Presence) => void;

/**
 * Manages presence event handlers for different topics
 */
// Extended presence packet type that might include subscribers
type EnrichedPresencePacket = PresencePacketType & {
  subscribers?: string[];
};

export class PresenceManager {
  #connectionId: string;
  #presenceHandlers = new Map<string, Set<PresenceHandler>>();

  constructor(connectionId: string) {
    this.#connectionId = connectionId;
    console.log(`[${this.#connectionId}] PresenceManager created`);
  }

  /**
   * Type guard to check if presence packet has subscribers property
   */
  #hasSubscribers(
    packet: PresencePacketType,
  ): packet is EnrichedPresencePacket {
    return (
      "subscribers" in packet &&
      Array.isArray((packet as Record<string, unknown>)["subscribers"])
    );
  }

  /**
   * Register a presence handler for a specific topic
   * @param topic - The topic to listen for presence updates on
   * @param handler - The callback function to handle presence updates
   */
  onPresence(topic: string, handler: PresenceHandler): void {
    console.log(`[${this.#connectionId}] Adding presence handler for topic`, {
      topic,
    });

    // Validate inputs
    if (!topic || typeof topic !== "string" || topic.trim().length === 0) {
      const error = "Invalid topic: must be a non-empty string";
      console.error(`[${this.#connectionId}] ${error}`, { topic });
      throw new Error(error);
    }

    if (typeof handler !== "function") {
      const error = "Invalid handler: must be a function";
      console.error(`[${this.#connectionId}] ${error}`);
      throw new Error(error);
    }

    // Initialize topic handler set if it doesn't exist
    if (!this.#presenceHandlers.has(topic)) {
      this.#presenceHandlers.set(topic, new Set());
    }

    // Add the handler
    this.#presenceHandlers.get(topic)!.add(handler);

    console.log(`[${this.#connectionId}] Presence handler added`, {
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
    console.log(`[${this.#connectionId}] Removing presence handler for topic`, {
      topic,
    });

    const handlers = this.#presenceHandlers.get(topic);
    if (!handlers) {
      console.warn(`[${this.#connectionId}] No handlers found for topic`, {
        topic,
      });
      return;
    }

    handlers.delete(handler);

    // Clean up empty handler sets
    if (handlers.size === 0) {
      this.#presenceHandlers.delete(topic);
    }

    console.log(`[${this.#connectionId}] Presence handler removed`, {
      topic,
      remainingHandlers: handlers.size,
    });
  }

  /**
   * Remove all presence handlers for a specific topic
   * @param topic - The topic to clear all handlers for
   */
  clearPresenceHandlers(topic: string): void {
    console.log(
      `[${this.#connectionId}] Clearing all presence handlers for topic`,
      { topic },
    );
    this.#presenceHandlers.delete(topic);
  }

  /**
   * Remove all presence handlers for all topics
   */
  clearAllPresenceHandlers(): void {
    console.log(`[${this.#connectionId}] Clearing all presence handlers`);
    this.#presenceHandlers.clear();
  }

  /**
   * Handle incoming presence packet
   * @param presencePacket - The presence packet received from the server
   */
  handlePresencePacket(presencePacket: PresencePacketType): void {
    console.log(`[${this.#connectionId}] Handling presence packet`, {
      clientCount: presencePacket.clients.length,
      clients: presencePacket.clients,
    });

    // Process each client in the batched presence packet
    for (const client of presencePacket.clients) {
      const handlers = this.#presenceHandlers.get(client.topic);
      if (!handlers || handlers.size === 0) {
        console.log(
          `[${this.#connectionId}] No presence handlers found for topic`,
          {
            topic: client.topic,
          },
        );
        continue;
      }

      // Create presence event data
      const presenceEvent: Presence = {
        clientId: client.clientId,
        topic: client.topic,
        status: client.status,
        timestamp: Date.now(),
        // Include subscribers array if present (for enriched self presence updates)
        // Check if the packet has subscribers property and it's an array
        ...(this.#hasSubscribers(presencePacket) && {
          subscribers: presencePacket.subscribers,
        }),
      };

      // Call all handlers for this topic
      for (const handler of handlers) {
        try {
          handler(presenceEvent);
        } catch (error) {
          console.error(`[${this.#connectionId}] Error in presence handler`, {
            error,
            topic: client.topic,
            clientId: client.clientId,
          });
          // Continue with other handlers even if one fails
        }
      }

      console.log(
        `[${this.#connectionId}] Presence event handled successfully`,
        {
          topic: client.topic,
          clientId: client.clientId,
          handlersCount: handlers.size,
        },
      );
    }
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
