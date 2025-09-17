import { MessageBodySchema, type MessageBody } from "@repo/schemas/messageBody";
import {
  PacketEnvelopeSchema,
  type PacketEnvelope,
  AckPublishOk,
  AckPublishErr,
  AckSubscription,
  PresencePacket,
} from "@repo/schemas/packetEnvelope";

import { logger } from "@/internal/logger/consola";

export function encodeEnvelope(pkt: PacketEnvelope): string {
  logger.info("[encodeEnvelope] called", { packetType: pkt.packetType });
  // validate before sending so bugs surface on the client side
  logger.info("[encodeEnvelope] validating packet", {
    packetType: pkt.packetType,
  });
  PacketEnvelopeSchema.parse(pkt);
  logger.info("[encodeEnvelope] packet validated", {
    packetType: pkt.packetType,
  });
  const encoded = JSON.stringify(pkt);
  logger.info("[encodeEnvelope] packet encoded", {
    packetType: pkt.packetType,
    encodedLength: encoded.length,
  });
  return encoded;
}

/* eslint-disable -- reason: I don't want to handle this now TODO */
export function parseServerFrame(raw: string): PacketEnvelope | null {
  logger.info("[parseServerFrame] called", { rawLength: raw.length });

  // Basic validation
  if (!raw || typeof raw !== "string" || raw.trim().length === 0) {
    logger.warn("[parseServerFrame] Invalid raw data", { raw });
    return null;
  }

  try {
    logger.info("[parseServerFrame] parsing JSON");
    const data = JSON.parse(raw);
    logger.info("[parseServerFrame] JSON parsed", { keys: Object.keys(data) });

    // Additional validation before schema parsing
    if (!data || typeof data !== "object") {
      logger.warn("[parseServerFrame] Parsed data is not an object", { data });
      return null;
    }

    // Check if it's an ACK packet or message packet
    if (data.packetType === "ack") {
      logger.info("[parseServerFrame] validating ACK packet schema");
      // Handle ACK packets with custom parsing due to duplicate discriminator values
      const parsed = parseAckPacket(data);
      if (parsed) {
        logger.info("[parseServerFrame] ACK packet validated", {
          clientMsgId: data.clientMsgId,
        });
        return parsed;
      } else {
        logger.warn("[parseServerFrame] ACK packet parsing failed");
        return null;
      }
    } else if (data.packetType === "presence") {
      logger.info("[parseServerFrame] validating presence packet schema");
      const presence = PresencePacket.parse(data);
      logger.info("[parseServerFrame] presence packet validated", {
        topic: presence.topic,
        clientId: presence.clientId,
      });
      return presence as PacketEnvelope;
    } else {
      // Legacy message parsing for backward compatibility
      if (!data.topic || typeof data.topic !== "string") {
        logger.warn("[parseServerFrame] Missing or invalid topic", { data });
        return null;
      }

      logger.info("[parseServerFrame] validating message schema");
      const parsed = MessageBodySchema.parse(data);
      logger.info("[parseServerFrame] message schema validated", {
        topic: parsed.topic,
      });

      // Convert to publish packet format
      return {
        packetType: "publish",
        topic: parsed.topic,
        payload: parsed,
      } as PacketEnvelope;
    }
  } catch (err) {
    logger.warn(`[parseServerFrame] failed ${raw}`, {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
/* eslint-enable */

/**
 * Parse ACK packets with manual handling to avoid discriminated union issues
 */
/* eslint-disable -- reason: I don't want to handle this now TODO */
function parseAckPacket(data: any): PacketEnvelope | null {
  try {
    // Manual validation and parsing without relying on discriminated unions
    if (data.packetType !== "ack") {
      return null;
    }

    if (!data.result || typeof data.result !== "object") {
      return null;
    }

    const ackResult = data.result;
    const path = ackResult.path;

    if (path === "subscribe" || path === "unsubscribe") {
      // Handle subscription ACKs
      const subscriptionAck = AckSubscription.parse(ackResult);
      return {
        packetType: "ack",
        clientMsgId: data.clientMsgId,
        result: subscriptionAck,
      };
    } else if (path === "publish") {
      // Handle publish ACKs by checking the result structure
      if (
        ackResult.result &&
        typeof ackResult.result === "object" &&
        "ok" in ackResult.result
      ) {
        if (ackResult.result.ok) {
          // Success ACK
          const successAck = AckPublishOk.parse(ackResult);
          return {
            packetType: "ack",
            clientMsgId: data.clientMsgId,
            result: successAck,
          };
        } else {
          // Error ACK
          const errorAck = AckPublishErr.parse(ackResult);
          return {
            packetType: "ack",
            clientMsgId: data.clientMsgId,
            result: errorAck,
          };
        }
      }
    }

    logger.warn("[parseAckPacket] Unknown ACK type", { path });
    return null;
  } catch (error) {
    logger.warn("[parseAckPacket] Failed to parse ACK packet", { error });
    return null;
  }
}
/* eslint-enable */

/**
 * Legacy function for backward compatibility
 * @deprecated Use parseServerFrame instead
 */
export function parseMessageBody(raw: string): MessageBody | null {
  logger.info("[parseMessageBody] called (legacy)", { rawLength: raw.length });
  const packet = parseServerFrame(raw);
  if (packet && packet.packetType === "publish") {
    return packet.payload;
  }
  return null;
}
