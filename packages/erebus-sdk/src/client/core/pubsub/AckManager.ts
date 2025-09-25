import type { AckPacketType } from "../../../../../schemas/packetEnvelope";
import type {
  PendingPublish,
  AckResponse,
  PendingSubscription,
  SubscriptionResponse,
} from "../types";
import type { StateManager } from "./StateManager";
import type { IAckManager } from "./interfaces";

// Type for subscription error results (not currently in schema)
type SubscriptionErrorResult = {
  ok: false;
  code: string;
  message: string;
};

/**
 * Manages ACK tracking and timeout handling for publish and subscription operations
 */
export class AckManager implements IAckManager {
  #pendingPublishes = new Map<string, PendingPublish>();
  #clientMsgIdToRequestId = new Map<string, string>();
  #pendingSubscriptions = new Map<string, PendingSubscription>();
  #subscriptionMsgIdToRequestId = new Map<string, string>();
  #connectionId: string;
  #stateManager?: StateManager;

  constructor(connectionId: string) {
    this.#connectionId = connectionId;
    console.log(`[${this.#connectionId}] AckManager created`);
  }

  setStateManager(stateManager: StateManager): void {
    this.#stateManager = stateManager;
  }

  trackPublish(requestId: string, pending: PendingPublish): void {
    console.log(`[${this.#connectionId}] Tracking publish for ACK`, {
      requestId,
      clientMsgId: pending.clientMsgId,
      topic: pending.topic,
    });

    this.#pendingPublishes.set(requestId, pending);
    this.#clientMsgIdToRequestId.set(pending.clientMsgId, requestId);

    // Set up timeout if specified
    if (pending.timeoutId) {
      console.log(`[${this.#connectionId}] ACK timeout set`, {
        requestId,
        timeout: "already configured",
      });
    }
  }

  trackSubscription(requestId: string, pending: PendingSubscription): void {
    console.log(`[${this.#connectionId}] Tracking subscription for ACK`, {
      requestId,
      clientMsgId: pending.clientMsgId,
      topic: pending.topic,
      path: pending.path,
      clientMsgIdType: typeof pending.clientMsgId,
      clientMsgIdLength: pending.clientMsgId?.length,
    });

    this.#pendingSubscriptions.set(requestId, pending);
    if (pending.clientMsgId) {
      this.#subscriptionMsgIdToRequestId.set(pending.clientMsgId, requestId);
      console.log(`[${this.#connectionId}] Stored clientMsgId mapping`, {
        clientMsgId: pending.clientMsgId,
        requestId,
        totalMappings: this.#subscriptionMsgIdToRequestId.size,
      });
    } else {
      console.log(
        `[${this.#connectionId}] No clientMsgId provided for subscription tracking`,
        {
          requestId,
          note: "ACK matching will rely on other mechanisms",
        },
      );
    }

    // Set up timeout if specified
    if (pending.timeoutId) {
      console.log(`[${this.#connectionId}] Subscription ACK timeout set`, {
        requestId,
        timeout: "already configured",
      });
    }
  }

  handleAck(ackPacket: AckPacketType): void {
    console.log(`[${this.#connectionId}] Handling ACK packet`, {
      clientMsgId: ackPacket.clientMsgId,
      path: ackPacket.result.path,
    });

    // Route to appropriate handler based on ACK type
    if (ackPacket.result.path === "publish") {
      this.#handlePublishAck(ackPacket);
    } else if (
      ackPacket.result.path === "subscribe" ||
      ackPacket.result.path === "unsubscribe"
    ) {
      this.#handleSubscriptionAck(ackPacket);
    } else {
      console.warn(`[${this.#connectionId}] Unknown ACK path`, {
        path: ackPacket.result.path,
        clientMsgId: ackPacket.clientMsgId,
      });
    }
  }

  #handlePublishAck(ackPacket: AckPacketType): void {
    const clientMsgId = ackPacket.clientMsgId;
    if (!clientMsgId) {
      console.warn(
        `[${this.#connectionId}] Publish ACK packet missing clientMsgId`,
      );
      return;
    }

    const requestId = this.#clientMsgIdToRequestId.get(clientMsgId);
    if (!requestId) {
      console.warn(
        `[${this.#connectionId}] No requestId found for publish clientMsgId`,
        {
          clientMsgId,
        },
      );
      return;
    }

    const pending = this.#pendingPublishes.get(requestId);
    if (!pending) {
      console.warn(`[${this.#connectionId}] No pending publish found for ACK`, {
        requestId,
        clientMsgId,
      });
      return;
    }

    // Clear timeout
    if (pending.timeoutId) {
      clearTimeout(pending.timeoutId);
    }

    // Remove from pending
    this.#pendingPublishes.delete(requestId);
    this.#clientMsgIdToRequestId.delete(clientMsgId);

    // Create response based on ACK type
    const response = this.#createAckResponse(ackPacket, pending);

    console.log(`[${this.#connectionId}] Calling publish ACK callback`, {
      requestId,
      clientMsgId,
      success: response.success,
    });

    try {
      pending.callback(response);
    } catch (error) {
      console.error(`[${this.#connectionId}] Error in publish ACK callback`, {
        error,
        requestId,
        clientMsgId,
      });
    }
  }

  #handleSubscriptionAck(ackPacket: AckPacketType): void {
    const clientMsgId = ackPacket.clientMsgId;

    // For subscription ACKs, clientMsgId might be optional/generated by server
    let requestId: string | undefined;
    let pending: PendingSubscription | undefined;

    console.log(`[${this.#connectionId}] Processing subscription ACK`, {
      path: ackPacket.result.path,
      topic: ackPacket.result.topic,
      clientMsgId,
      pendingSubscriptionCount: this.#pendingSubscriptions.size,
      subscriptionMsgIdMappings: Array.from(
        this.#subscriptionMsgIdToRequestId.entries(),
      ).map(([k, v]) => `${k} -> ${v}`),
    });

    if (clientMsgId) {
      requestId = this.#subscriptionMsgIdToRequestId.get(clientMsgId);
      console.log(
        `[${this.#connectionId}] Looking up clientMsgId in mappings`,
        {
          clientMsgId,
          foundRequestId: requestId,
        },
      );

      if (requestId) {
        pending = this.#pendingSubscriptions.get(requestId);
        console.log(
          `[${this.#connectionId}] Looking up requestId in pending subscriptions`,
          {
            requestId,
            foundPending: !!pending,
          },
        );
      } else {
        // Fallback: Check if clientMsgId directly matches a pending requestId
        // This handles cases where server echoes requestId as clientMsgId
        console.log(
          `[${this.#connectionId}] No direct mapping found, checking if clientMsgId matches a requestId`,
          {
            clientMsgId,
          },
        );
        pending = this.#pendingSubscriptions.get(clientMsgId);
        if (pending) {
          requestId = clientMsgId;
          console.log(
            `[${this.#connectionId}] Found pending subscription by matching clientMsgId to requestId`,
            {
              clientMsgId,
              requestId,
            },
          );
        }
      }
    }

    if (!pending) {
      // No tracked subscription - optimistic subscription path.
      // We still need to reflect the server-confirmed state so waiters can proceed.
      console.log(
        `[${this.#connectionId}] Received untracked subscription ACK`,
        {
          path: ackPacket.result.path,
          topic: ackPacket.result.topic,
          clientMsgId,
          note: "Optimistic subscription confirmed by server",
        },
      );

      if (this.#stateManager) {
        const topic = ackPacket.result.topic;
        const path = ackPacket.result.path;
        if (path === "subscribe") {
          this.#stateManager.setSubscriptionStatus(topic, "subscribed");
        } else if (path === "unsubscribe") {
          this.#stateManager.setSubscriptionStatus(topic, "unsubscribed");
        }
      }
      return;
    }

    console.log(`[${this.#connectionId}] Handling tracked subscription ACK`, {
      requestId,
      clientMsgId,
      topic: pending.topic,
      path: pending.path,
    });

    // Clear timeout
    if (pending.timeoutId) {
      clearTimeout(pending.timeoutId);
    }

    // Remove from pending
    this.#pendingSubscriptions.delete(requestId!);
    if (clientMsgId) {
      this.#subscriptionMsgIdToRequestId.delete(clientMsgId);
    }

    // Create response based on ACK type
    const response = this.#createSubscriptionResponse(ackPacket, pending);

    console.log(`[${this.#connectionId}] Calling subscription ACK callback`, {
      requestId,
      clientMsgId,
      topic: pending.topic,
      success: response.success,
    });

    try {
      pending.callback(response);

      // Notify StateManager about subscription confirmation
      if (this.#stateManager) {
        if (response.success) {
          this.#stateManager.setSubscriptionStatus(pending.topic, "subscribed");
        } else {
          this.#stateManager.setSubscriptionStatus(
            pending.topic,
            "unsubscribed",
          );
        }
      }
    } catch (error) {
      console.error(
        `[${this.#connectionId}] Error in subscription ACK callback`,
        {
          error,
          requestId,
          clientMsgId,
          topic: pending.topic,
        },
      );
    }
  }

  handlePublishTimeout(requestId: string): void {
    console.warn(`[${this.#connectionId}] Publish ACK timeout`, { requestId });

    const pending = this.#pendingPublishes.get(requestId);
    if (!pending) {
      return; // Already handled
    }

    // Remove from pending
    this.#pendingPublishes.delete(requestId);
    this.#clientMsgIdToRequestId.delete(pending.clientMsgId);

    // Create timeout error response
    const response: AckResponse = {
      success: false,
      ack: {} as AckPacketType, // Empty ACK since we didn't receive one
      error: {
        code: "TIMEOUT",
        message: "Publish ACK not received within timeout",
      },
      topic: pending.topic,
    };

    try {
      pending.callback(response);
    } catch (error) {
      console.error(
        `[${this.#connectionId}] Error in publish timeout callback`,
        {
          error,
          requestId,
        },
      );
    }
  }

  handleSubscriptionTimeout(requestId: string): void {
    console.warn(`[${this.#connectionId}] Subscription ACK timeout`, {
      requestId,
    });

    const pending = this.#pendingSubscriptions.get(requestId);
    if (!pending) {
      return; // Already handled
    }

    // Remove from pending
    this.#pendingSubscriptions.delete(requestId);
    if (pending.clientMsgId) {
      this.#subscriptionMsgIdToRequestId.delete(pending.clientMsgId);
    }

    // Create timeout error response
    const response: SubscriptionResponse = {
      success: false,
      error: {
        code: "TIMEOUT",
        message: "Subscription ACK not received within timeout",
      },
      topic: pending.topic,
      path: pending.path,
    };

    try {
      pending.callback(response);

      // Notify StateManager about subscription failure
      if (this.#stateManager) {
        this.#stateManager.setSubscriptionStatus(pending.topic, "unsubscribed");
      }
    } catch (error) {
      console.error(
        `[${this.#connectionId}] Error in subscription timeout callback`,
        {
          error,
          requestId,
          topic: pending.topic,
        },
      );

      // Notify StateManager about subscription failure even on error
      if (this.#stateManager) {
        this.#stateManager.setSubscriptionStatus(pending.topic, "unsubscribed");
      }
    }
  }

  cleanup(reason: string): void {
    console.log(`[${this.#connectionId}] Cleaning up pending operations`, {
      publishCount: this.#pendingPublishes.size,
      subscriptionCount: this.#pendingSubscriptions.size,
      reason,
    });

    // Cleanup pending publishes
    for (const [requestId, pending] of this.#pendingPublishes) {
      // Clear timeout
      if (pending.timeoutId) {
        clearTimeout(pending.timeoutId);
      }

      // Create error response
      const response: AckResponse = {
        success: false,
        ack: {} as AckPacketType,
        error: {
          code: "CONNECTION_ERROR",
          message: reason,
        },
        topic: pending.topic,
      };

      try {
        pending.callback(response);
      } catch (error) {
        console.error(
          `[${this.#connectionId}] Error in publish cleanup callback`,
          {
            error,
            requestId,
            clientMsgId: pending.clientMsgId,
          },
        );
      }
    }

    // Cleanup pending subscriptions
    for (const [requestId, pending] of this.#pendingSubscriptions) {
      // Clear timeout
      if (pending.timeoutId) {
        clearTimeout(pending.timeoutId);
      }

      // Create error response
      const response: SubscriptionResponse = {
        success: false,
        error: {
          code: "CONNECTION_ERROR",
          message: reason,
        },
        topic: pending.topic,
        path: pending.path,
      };

      try {
        pending.callback(response);
      } catch (error) {
        console.error(
          `[${this.#connectionId}] Error in subscription cleanup callback`,
          {
            error,
            requestId,
            clientMsgId: pending.clientMsgId,
            topic: pending.topic,
          },
        );
      }
    }

    this.#pendingPublishes.clear();
    this.#clientMsgIdToRequestId.clear();
    this.#pendingSubscriptions.clear();
    this.#subscriptionMsgIdToRequestId.clear();
  }

  getPendingCount(): number {
    return this.#pendingPublishes.size;
  }

  getPendingSubscriptionCount(): number {
    return this.#pendingSubscriptions.size;
  }

  #createAckResponse(
    ackPacket: AckPacketType,
    pending: PendingPublish,
  ): AckResponse {
    if (ackPacket.result.path === "publish") {
      if ("result" in ackPacket.result && ackPacket.result.result.ok) {
        // Success ACK
        return {
          success: true,
          ack: ackPacket,
          seq: ackPacket.result.seq,
          serverMsgId: ackPacket.result.serverAssignedId,
          topic: ackPacket.result.topic,
        };
      } else if ("result" in ackPacket.result && !ackPacket.result.result.ok) {
        // Error ACK
        return {
          success: false,
          ack: ackPacket,
          error: {
            code: ackPacket.result.result.code,
            message: ackPacket.result.result.message,
          },
          topic: ackPacket.result.topic,
        };
      } else {
        // Malformed ACK
        return {
          success: false,
          ack: ackPacket,
          error: {
            code: "MALFORMED_ACK",
            message: "ACK packet has invalid structure",
          },
          topic: pending.topic,
        };
      }
    } else {
      // Non-publish ACK (subscription, etc.) - these are handled elsewhere or ignored
      console.log(`[${this.#connectionId}] Received non-publish ACK`, {
        path: ackPacket.result.path,
        clientMsgId: ackPacket.clientMsgId,
        note: "Subscription ACKs are not tracked in AckManager",
      });

      // Return a generic error for non-publish ACKs that somehow got tracked
      return {
        success: false,
        ack: ackPacket,
        error: {
          code: "INVALID_ACK_TYPE",
          message: "Received non-publish ACK for publish operation",
        },
        topic: pending.topic,
      };
    }
  }

  #createSubscriptionResponse(
    ackPacket: AckPacketType,
    pending: PendingSubscription,
  ): SubscriptionResponse {
    if (
      ackPacket.result.path === "subscribe" ||
      ackPacket.result.path === "unsubscribe"
    ) {
      if ("result" in ackPacket.result) {
        const result = ackPacket.result.result;

        if (result.ok) {
          // Success ACK - has status property
          return {
            success: true,
            ack: ackPacket,
            topic: ackPacket.result.topic,
            status: result.status,
            path: ackPacket.result.path,
          };
        } else {
          // Error ACK - has code and message properties
          // Type guard to check if this looks like an error result
          const isErrorResult = (r: unknown): r is SubscriptionErrorResult => {
            if (typeof r !== "object" || r === null) return false;
            const obj = r as Record<string, unknown>;
            return (
              obj["ok"] === false &&
              typeof obj["code"] === "string" &&
              typeof obj["message"] === "string"
            );
          };

          const errorResult = isErrorResult(result)
            ? result
            : {
                ok: false as const,
                code: "SUBSCRIPTION_ERROR",
                message: "Subscription operation failed",
              };

          return {
            success: false,
            ack: ackPacket,
            error: {
              code: errorResult.code,
              message: errorResult.message,
            },
            topic: ackPacket.result.topic,
            path: ackPacket.result.path,
          };
        }
      } else {
        // Malformed subscription ACK
        return {
          success: false,
          ack: ackPacket,
          error: {
            code: "MALFORMED_ACK",
            message: "Subscription ACK packet has invalid structure",
          },
          topic: pending.topic,
          path: pending.path,
        };
      }
    } else {
      // Wrong ACK type for subscription
      return {
        success: false,
        ack: ackPacket,
        error: {
          code: "INVALID_ACK_TYPE",
          message: "Received non-subscription ACK for subscription operation",
        },
        topic: pending.topic,
        path: pending.path,
      };
    }
  }
}
