import { logger } from "@/internal/logger/consola";
import type { AckPacketType } from "@repo/schemas/packetEnvelope";

export type ErebusOptions = {
  wsUrl: string; // wss://...
  tokenProvider: () => Promise<string> | string; // calls EREBUS_GRANT_URL
  heartbeatMs?: number; // default 25_000
  log?: (l: "info" | "warn" | "error", msg: string, meta?: unknown) => void;
};

export type MessageMeta = {
  topic: string;
  seq?: string;
  ts?: number;
  region?: string;
};

export type Unsubscribe = () => void;

/**
 * ACK response for successful operations
 */
export type AckSuccess = {
  success: true;
  ack: AckPacketType;
  seq: string;
  serverMsgId: string;
  topic: string;
};

/**
 * ACK response for failed operations
 */
export type AckError = {
  success: false;
  ack: AckPacketType;
  error: {
    code: string;
    message: string;
  };
  topic: string;
};

/**
 * Combined ACK response type
 */
export type AckResponse = AckSuccess | AckError;

/**
 * Callback function for ACK responses
 */
export type AckCallback = (response: AckResponse) => void;

/**
 * Pending publish request tracking
 */
export type PendingPublish = {
  requestId: string;
  clientMsgId: string;
  topic: string;
  callback: AckCallback;
  timestamp: number;
  timeoutId?: NodeJS.Timeout;
};

export function logTypeInfo(label: string, value: unknown) {
  logger.info("type info", { label, valueType: typeof value });
}
