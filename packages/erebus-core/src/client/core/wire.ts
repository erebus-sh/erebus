import { logger } from "@/internal/logger/consola";
import {
  PacketEnvelopeSchema,
  type PacketEnvelope,
} from "@/internal/schemas/packetEnvelope";
import {
  MessageBodySchema,
  type MessageBody,
} from "@/internal/schemas/messageBody";

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

export function parseServerFrame(raw: string): MessageBody | null {
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

    if (!data.topic || typeof data.topic !== "string") {
      logger.warn("[parseServerFrame] Missing or invalid topic", { data });
      return null;
    }

    logger.info("[parseServerFrame] validating schema");
    const parsed = MessageBodySchema.parse(data);
    logger.info("[parseServerFrame] schema validated", { topic: parsed.topic });
    logger.info("[parseServerFrame] success", { topic: parsed.topic });
    return parsed;
  } catch (err) {
    logger.warn(
      "[parseServerFrame] failed",
      { error: err instanceof Error ? err.message : String(err) },
      raw,
    );
    return null;
  }
}
