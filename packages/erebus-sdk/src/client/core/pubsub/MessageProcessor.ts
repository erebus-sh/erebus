import type {
  PacketEnvelope,
  AckPacketType,
} from "@repo/schemas/packetEnvelope";

import { parseServerFrame } from "@/client/core/wire";
import { logger } from "@/internal/logger/consola";

import type { PresenceManager } from "./Presence";
import type { IMessageProcessor, OnMessage, IAckManager } from "./interfaces";

/**
 * Handles incoming message parsing and routing
 */
export class MessageProcessor implements IMessageProcessor {
  #connectionId: string;
  #onMessage: OnMessage;
  #ackManager: IAckManager;
  #presenceManager: PresenceManager;

  constructor(
    connectionId: string,
    onMessage: OnMessage,
    ackManager: IAckManager,
    presenceManager: PresenceManager,
  ) {
    this.#connectionId = connectionId;
    this.#onMessage = onMessage;
    this.#ackManager = ackManager;
    this.#presenceManager = presenceManager;
    logger.info(`[${this.#connectionId}] MessageProcessor created`);
  }

  processMessage(dataStr: string): PacketEnvelope | null {
    logger.info(`[${this.#connectionId}] Processing message`, {
      dataLength: dataStr.length,
    });

    if (dataStr.length === 0) {
      logger.warn(`[${this.#connectionId}] Data string is empty, skipping`);
      return null;
    }

    // Ping packet just skip it
    if (dataStr === "ping") {
      logger.warn(`[${this.#connectionId}] Ping packet, skipping`, {
        rawDataPreview: dataStr.slice(0, 200),
      });
      return null;
    }

    const parsed = parseServerFrame(dataStr);
    if (!parsed) {
      logger.warn(`[${this.#connectionId}] Failed to parse server frame`, {
        rawDataPreview: dataStr.slice(0, 200),
      });
      return null;
    }

    logger.info(`[${this.#connectionId}] Parsed packet`, {
      packetType: parsed.packetType,
    });

    this.handlePacket(parsed);
    return parsed;
  }

  handlePacket(packet: PacketEnvelope): void {
    try {
      // Handle ACK packets
      if (packet.packetType === "ack") {
        this.#handleAckPacket(packet);
      } else if (packet.packetType === "publish") {
        // Handle regular publish messages
        logger.info(`[${this.#connectionId}] Handling publish message`, {
          topic: packet.payload?.topic,
          messageId: packet.payload?.id || "unknown",
        });
        this.#onMessage(packet);
      } else if (packet.packetType === "presence") {
        // Handle presence packets
        logger.info(`[${this.#connectionId}] Handling presence packet`, {
          topic: packet.topic,
          clientId: packet.clientId,
          status: packet.status,
        });
        this.#presenceManager.handlePresencePacket(packet);
      } else {
        logger.warn(`[${this.#connectionId}] Unknown packet type`, {
          packetType: packet.packetType,
        });
      }
    } catch (error) {
      logger.error(`[${this.#connectionId}] Error handling packet`, {
        error,
        packetType: packet.packetType,
      });
      // Don't rethrow - we want to keep the connection alive even if handlers fail
    }
  }

  #handleAckPacket(ackPacket: AckPacketType): void {
    logger.info(`[${this.#connectionId}] Processing ACK packet`, {
      clientMsgId: ackPacket.clientMsgId,
      path: ackPacket.result.path,
    });

    // Route all ACKs to the ACK manager - it will handle both publish and subscription ACKs
    this.#ackManager.handleAck(ackPacket);
  }
}
