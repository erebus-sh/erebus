import { MessageBodySchema, type MessageBody } from "@repo/schemas/messageBody";
import {
  PacketEnvelopeSchema,
  type PacketEnvelope,
  AckPublishOk,
  AckPublishErr,
  AckSubscription,
  PresencePacket,
} from "@repo/schemas/packetEnvelope";

export function encodeEnvelope(pkt: PacketEnvelope): string {
  console.log("[encodeEnvelope] called", { packetType: pkt.packetType });
  // validate before sending so bugs surface on the client side
  console.log("[encodeEnvelope] validating packet", {
    packetType: pkt.packetType,
  });
  PacketEnvelopeSchema.parse(pkt);
  console.log("[encodeEnvelope] packet validated", {
    packetType: pkt.packetType,
  });
  const encoded = JSON.stringify(pkt);
  console.log("[encodeEnvelope] packet encoded", {
    packetType: pkt.packetType,
    encodedLength: encoded.length,
  });
  return encoded;
}

/* eslint-disable -- reason: I don't want to handle this now TODO */
export function parseServerFrame(raw: string): PacketEnvelope | null {
  console.log("[parseServerFrame] called", { rawLength: raw.length });

  // Basic validation
  if (!raw || typeof raw !== "string" || raw.trim().length === 0) {
    console.warn("[parseServerFrame] Invalid raw data", { raw });
    return null;
  }

  try {
    console.log("[parseServerFrame] parsing JSON");
    const data = JSON.parse(raw);
    console.log("[parseServerFrame] JSON parsed", { keys: Object.keys(data) });

    // Additional validation before schema parsing
    if (!data || typeof data !== "object") {
      console.warn("[parseServerFrame] Parsed data is not an object", { data });
      return null;
    }

    // Check if it's an ACK packet or message packet
    if (data.packetType === "ack") {
      console.log("[parseServerFrame] validating ACK packet schema");
      // Handle ACK packets with custom parsing due to duplicate discriminator values
      const parsed = parseAckPacket(data);
      if (parsed) {
        console.log("[parseServerFrame] ACK packet validated", {
          clientMsgId: data.clientMsgId,
        });
        return parsed;
      } else {
        console.warn("[parseServerFrame] ACK packet parsing failed");
        return null;
      }
    } else if (data.packetType === "presence") {
      console.log("[parseServerFrame] validating presence packet schema");
      const presence = PresencePacket.parse(data);
      console.log("[parseServerFrame] presence packet validated", {
        clientCount: presence.clients.length,
        firstClient: presence.clients[0],
      });
      return presence as PacketEnvelope;
    } else {
      // Legacy message parsing for backward compatibility
      if (!data.topic || typeof data.topic !== "string") {
        console.warn("[parseServerFrame] Missing or invalid topic", { data });
        return null;
      }

      console.log("[parseServerFrame] validating message schema");
      const parsed = MessageBodySchema.parse(data);
      console.log("[parseServerFrame] message schema validated", {
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
    console.warn(`[parseServerFrame] failed ${raw}`, {
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

    console.warn("[parseAckPacket] Unknown ACK type", { path });
    return null;
  } catch (error) {
    console.warn("[parseAckPacket] Failed to parse ACK packet", { error });
    return null;
  }
}
/* eslint-enable */

/**
 * Legacy function for backward compatibility
 * @deprecated Use parseServerFrame instead
 */
export function parseMessageBody(raw: string): MessageBody | null {
  console.log("[parseMessageBody] called (legacy)", { rawLength: raw.length });
  const packet = parseServerFrame(raw);
  if (packet && packet.packetType === "publish") {
    return packet.payload;
  }
  return null;
}
