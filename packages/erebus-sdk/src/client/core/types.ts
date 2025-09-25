import type { AckPacketType } from "../../../../schemas/packetEnvelope";

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
 * Subscription response for successful operations
 */
export type SubscriptionSuccess = {
  success: true;
  ack: AckPacketType;
  topic: string;
  status: "subscribed" | "unsubscribed";
  path: "subscribe" | "unsubscribe";
};

/**
 * Subscription response for failed operations
 */
export type SubscriptionError = {
  success: false;
  ack?: AckPacketType;
  error: {
    code: string;
    message: string;
  };
  topic: string;
  path: "subscribe" | "unsubscribe";
};

/**
 * Combined subscription response type
 */
export type SubscriptionResponse = SubscriptionSuccess | SubscriptionError;

/**
 * Callback function for subscription responses
 */
export type SubscriptionCallback = (response: SubscriptionResponse) => void;

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

/**
 * Pending subscription request tracking
 */
export type PendingSubscription = {
  requestId: string;
  clientMsgId?: string;
  topic: string;
  path: "subscribe" | "unsubscribe";
  callback: SubscriptionCallback;
  timestamp: number;
  timeoutId?: NodeJS.Timeout;
};

export type Presence = {
  clientId: string;
  topic: string;
  status: "online" | "offline";
  timestamp: number;
  subscribers?: string[]; // Optional array of subscriber client IDs (for enriched self presence)
};

export const VERSION = "1" as const;
