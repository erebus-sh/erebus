import type { AckPacketType } from "@repo/schemas/packetEnvelope";
import type { PendingPublish, AckResponse } from "../types";
import type { IAckManager } from "./interfaces";
import { logger } from "@/internal/logger/consola";

/**
 * Manages ACK tracking and timeout handling for publish operations
 */
export class AckManager implements IAckManager {
  #pendingPublishes = new Map<string, PendingPublish>();
  #clientMsgIdToRequestId = new Map<string, string>();
  #connectionId: string;

  constructor(connectionId: string) {
    this.#connectionId = connectionId;
    logger.info(`[${this.#connectionId}] AckManager created`);
  }

  trackPublish(requestId: string, pending: PendingPublish): void {
    logger.info(`[${this.#connectionId}] Tracking publish for ACK`, {
      requestId,
      clientMsgId: pending.clientMsgId,
      topic: pending.topic,
    });

    this.#pendingPublishes.set(requestId, pending);
    this.#clientMsgIdToRequestId.set(pending.clientMsgId, requestId);

    // Set up timeout if specified
    if (pending.timeoutId) {
      logger.info(`[${this.#connectionId}] ACK timeout set`, {
        requestId,
        timeout: "already configured",
      });
    }
  }

  handleAck(ackPacket: AckPacketType): void {
    logger.info(`[${this.#connectionId}] Handling ACK packet`, {
      clientMsgId: ackPacket.clientMsgId,
      path: ackPacket.type.path,
    });

    const clientMsgId = ackPacket.clientMsgId;
    if (!clientMsgId) {
      logger.warn(`[${this.#connectionId}] ACK packet missing clientMsgId`);
      return;
    }

    const requestId = this.#clientMsgIdToRequestId.get(clientMsgId);
    if (!requestId) {
      logger.warn(
        `[${this.#connectionId}] No requestId found for clientMsgId`,
        {
          clientMsgId,
        },
      );
      return;
    }

    const pending = this.#pendingPublishes.get(requestId);
    if (!pending) {
      logger.warn(`[${this.#connectionId}] No pending publish found for ACK`, {
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

    logger.info(`[${this.#connectionId}] Calling ACK callback`, {
      requestId,
      clientMsgId,
      success: response.success,
    });

    try {
      pending.callback(response);
    } catch (error) {
      logger.error(`[${this.#connectionId}] Error in ACK callback`, {
        error,
        requestId,
        clientMsgId,
      });
    }
  }

  handleTimeout(requestId: string): void {
    logger.warn(`[${this.#connectionId}] ACK timeout`, { requestId });

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
        message: "ACK not received within timeout",
      },
      topic: pending.topic,
    };

    try {
      pending.callback(response);
    } catch (error) {
      logger.error(`[${this.#connectionId}] Error in timeout callback`, {
        error,
        requestId,
      });
    }
  }

  cleanup(reason: string): void {
    logger.info(`[${this.#connectionId}] Cleaning up pending publishes`, {
      count: this.#pendingPublishes.size,
      reason,
    });

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
        logger.error(`[${this.#connectionId}] Error in cleanup callback`, {
          error,
          requestId,
          clientMsgId: pending.clientMsgId,
        });
      }
    }

    this.#pendingPublishes.clear();
    this.#clientMsgIdToRequestId.clear();
  }

  getPendingCount(): number {
    return this.#pendingPublishes.size;
  }

  #createAckResponse(
    ackPacket: AckPacketType,
    pending: PendingPublish,
  ): AckResponse {
    if (ackPacket.type.path === "publish") {
      if ("result" in ackPacket.type && ackPacket.type.result.ok) {
        // Success ACK
        return {
          success: true,
          ack: ackPacket,
          seq: ackPacket.type.seq,
          serverMsgId: ackPacket.type.serverAssignedId,
          topic: ackPacket.type.topic!,
        };
      } else if ("result" in ackPacket.type && !ackPacket.type.result.ok) {
        // Error ACK
        return {
          success: false,
          ack: ackPacket,
          error: {
            code: ackPacket.type.result.code,
            message: ackPacket.type.result.message,
          },
          topic: ackPacket.type.topic!,
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
      // Non-publish ACK (subscription, etc.)
      logger.info(`[${this.#connectionId}] Received non-publish ACK`, {
        path: ackPacket.type.path,
        clientMsgId: ackPacket.clientMsgId,
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
}
