import type { AckPacketType } from "@repo/schemas/packetEnvelope";
import type { ErebusClient } from "./ErebusClient";
import type { Logger } from "./service-utils";

/**
 * ACK factory and delivery utilities.
 *
 * These are pure functions that construct ACK packets for the wire protocol.
 * Extracted from the old BaseService to eliminate class hierarchy duplication.
 */

/**
 * Send an ACK packet to an ErebusClient connection.
 */
export function sendAck(
  client: ErebusClient,
  ackPacket: AckPacketType,
  log?: Logger,
): void {
  try {
    client.sendAck(ackPacket);
    log?.debug(`[SEND_ACK] ACK sent for path: ${ackPacket.result.path}`);
  } catch (error) {
    log?.error(`[SEND_ACK] Failed to send ACK: ${error}`);
  }
}

/**
 * Create a publish success ACK.
 */
export function createPublishSuccessAck(
  topic: string,
  serverMsgId: string,
  clientMsgId: string,
  seq: string,
  tIngress: number,
): AckPacketType {
  return {
    packetType: "ack",
    clientMsgId,
    result: {
      type: "ack",
      path: "publish",
      seq,
      serverAssignedId: serverMsgId,
      clientMsgId,
      topic,
      result: {
        ok: true,
        t_ingress: tIngress,
      },
    },
  };
}

/**
 * Create a publish error ACK.
 */
export function createPublishErrorAck(
  topic: string,
  clientMsgId: string,
  code: "UNAUTHORIZED" | "FORBIDDEN" | "INVALID" | "RATE_LIMITED" | "INTERNAL",
  message: string,
): AckPacketType {
  return {
    packetType: "ack",
    clientMsgId,
    result: {
      type: "ack",
      path: "publish",
      seq: "0",
      serverAssignedId: crypto.randomUUID(),
      clientMsgId,
      topic,
      result: {
        ok: false,
        code,
        message,
      },
    },
  };
}

/**
 * Create a subscription success ACK.
 */
export function createSubscriptionAck(
  requestId: string | undefined,
  topic: string,
  status: "subscribed" | "unsubscribed",
  path: "subscribe" | "unsubscribe",
): AckPacketType {
  return {
    packetType: "ack",
    clientMsgId: requestId,
    result: {
      type: "ack",
      path,
      seq: crypto.randomUUID(),
      serverAssignedId: crypto.randomUUID(),
      clientMsgId: requestId || crypto.randomUUID(),
      topic,
      result: {
        ok: true,
        status,
      },
    },
  };
}

// NOTE: The wire protocol schema (packetEnvelope.ts) does not yet support
// subscription error ACKs. The AckSubscription type only has { ok: true }.
// For now, unauthorized subscription attempts close the connection with
// an appropriate WebSocket error code. A future schema update can add
// AckSubscriptionErr to enable subscription error ACKs.
