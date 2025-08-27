import type {
  PacketEnvelope,
  AckPacketType,
} from "@repo/schemas/packetEnvelope";
import type { IMessageProcessor, OnMessage } from "./interfaces";
import type { IAckManager } from "./interfaces";
import { parseServerFrame } from "@/client/core/wire";
import { logger } from "@/internal/logger/consola";

/**
 * Handles incoming message parsing and routing
 */
export class MessageProcessor implements IMessageProcessor {
  #connectionId: string;
  #onMessage: OnMessage;
  #ackManager: IAckManager;

  constructor(
    connectionId: string,
    onMessage: OnMessage,
    ackManager: IAckManager,
  ) {
    this.#connectionId = connectionId;
    this.#onMessage = onMessage;
    this.#ackManager = ackManager;
    logger.info(`[${this.#connectionId}] MessageProcessor created`);
  }

  async processMessage(dataStr: string): Promise<PacketEnvelope | null> {
    logger.info(`[${this.#connectionId}] Processing message`, {
      dataLength: dataStr.length,
    });

    if (dataStr.length === 0) {
      logger.warn(`[${this.#connectionId}] Data string is empty, skipping`);
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

    await this.handlePacket(parsed);
    return parsed;
  }

  async handlePacket(packet: PacketEnvelope): Promise<void> {
    try {
      // Handle ACK packets
      if (packet.packetType === "ack") {
        await this.#handleAckPacket(packet as AckPacketType);
      } else if (packet.packetType === "publish") {
        // Handle regular publish messages
        logger.info(`[${this.#connectionId}] Handling publish message`, {
          topic: packet.payload?.topic,
          messageId: packet.payload?.id || "unknown",
        });
        this.#onMessage(packet);
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

  async #handleAckPacket(ackPacket: AckPacketType): Promise<void> {
    logger.info(`[${this.#connectionId}] Processing ACK packet`, {
      clientMsgId: ackPacket.clientMsgId,
      path: ackPacket.result.path,
    });

    // Route ACK to the ACK manager for processing
    this.#ackManager.handleAck(ackPacket);
  }
}
