import { logger } from "@/internal/logger/consola";
import {
  PacketEnvelopeSchema,
  type PacketEnvelope,
} from "@repo/schemas/packetEnvelope";
import { MessageBodySchema, type MessageBody } from "@repo/schemas/messageBody";

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
      const parsed = PacketEnvelopeSchema.parse(data);
      logger.info("[parseServerFrame] ACK packet validated", {
        requestId: data.requestId,
      });
      return parsed;
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
    logger.warn(
      "[parseServerFrame] failed",
      { error: err instanceof Error ? err.message : String(err) },
      raw,
    );
    return null;
  }
}

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
