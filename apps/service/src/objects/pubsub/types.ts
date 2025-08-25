import { MessageBody } from "@repo/schemas/messageBody";
import { Env } from "@/env";

/**
 * Result of a WebSocket send operation with detailed tracking
 */
export interface SocketSendResult {
  /** The result of the send operation */
  result: "sent" | "skipped" | "duplicate" | "error";
  /** Human-readable reason for the result */
  reason: string;
  /** Error details if result is 'error' */
  error?: unknown;
}

/**
 * Message record stored in Durable Object storage with TTL metadata
 */
export interface MessageRecord {
  /** The message body */
  body: MessageBody;
  /** Expiration timestamp in milliseconds */
  exp: number;
}

/**
 * Performance metrics for message processing
 */
export interface MessageMetrics {
  /** Number of messages sent successfully */
  sentCount: number;
  /** Number of messages skipped */
  skippedCount: number;
  /** Number of duplicate sends avoided */
  duplicateCount: number;
  /** Number of errors encountered */
  errorCount: number;
  /** Number of times execution yielded control */
  yieldCount: number;
  /** Number of high backpressure situations */
  highBackpressureCount: number;
}

/**
 * Context object for service dependency injection
 */
export interface ServiceContext {
  /** Durable Object state context */
  ctx: DurableObjectState;
  /** Environment variables and bindings */
  env: Env;
}

/**
 * Configuration for message broadcasting
 */
export interface BroadcastConfig {
  /** Number of WebSocket sends before yielding control */
  yieldEveryNSends: number;
  /** Low backpressure threshold in bytes */
  backpressureThresholdLow: number;
  /** High backpressure threshold in bytes */
  backpressureThresholdHigh: number;
  /** Batch size for socket processing */
  batchSize: number;
}

/**
 * Storage keys for different data types
 */
export interface StorageKeys {
  /** Key for subscriber lists: `subs:${projectId}:${channelName}:${topic}` */
  subscribers: (
    projectId: string,
    channelName: string,
    topic: string,
  ) => string;
  /** Key for messages: `msg:${projectId}:${channelName}:${topic}:${seq}` */
  message: (
    projectId: string,
    channelName: string,
    topic: string,
    seq: string,
  ) => string;
  /** Key for sequence numbers: `seq:${projectId}:${channelName}:${topic}` */
  sequence: (projectId: string, channelName: string, topic: string) => string;
  /** Key for last seen sequence: `last_seq_seen:${projectId}:${channelName}:${topic}:${clientId}` */
  lastSeenSequence: (
    projectId: string,
    channelName: string,
    topic: string,
    clientId: string,
  ) => string;
}

/**
 * Constants used throughout the pubsub system
 */
export const PUBSUB_CONSTANTS = {
  /** Maximum number of subscribers per topic */
  MAX_SUBSCRIBERS_PER_TOPIC: 5120,
  /** Message TTL in days */
  MESSAGE_TTL_DAYS: 3,
  /** Message TTL in seconds */
  MESSAGE_TTL_SECONDS: 3 * 24 * 60 * 60,
  /** Message TTL in milliseconds */
  MESSAGE_TTL_MS: 3 * 24 * 60 * 60 * 1000,
  /** Default limit for message retrieval */
  DEFAULT_MESSAGE_LIMIT: 100,
  /** Default limit for storage list operations */
  DEFAULT_STORAGE_LIST_LIMIT: 1000,
  /** Pruning limit per iteration */
  PRUNE_LIMIT_PER_ITERATION: 128,
} as const;

/**
 * Default broadcast configuration
 */
export const DEFAULT_BROADCAST_CONFIG: BroadcastConfig = {
  yieldEveryNSends: 10,
  backpressureThresholdLow: 10 * 1024, // 10KB
  backpressureThresholdHigh: 100 * 1024, // 100KB
  batchSize: 10,
} as const;

/**
 * Storage key generators
 */
export const STORAGE_KEYS: StorageKeys = {
  subscribers: (projectId: string, channelName: string, topic: string) =>
    `subs:${projectId}:${channelName}:${topic}`,
  message: (
    projectId: string,
    channelName: string,
    topic: string,
    seq: string,
  ) => `msg:${projectId}:${channelName}:${topic}:${seq}`,
  sequence: (projectId: string, channelName: string, topic: string) =>
    `seq:${projectId}:${channelName}:${topic}`,
  lastSeenSequence: (
    projectId: string,
    channelName: string,
    topic: string,
    clientId: string,
  ) => `last_seq_seen:${projectId}:${channelName}:${topic}:${clientId}`,
} as const;

/**
 * WebSocket send operation parameters
 */
export interface WebSocketSendParams {
  /** The WebSocket to send to */
  ws: WebSocket;
  /** Data to send (string or serializable object) */
  data: unknown;
}

/**
 * Parameters for message publishing
 */
export interface PublishMessageParams {
  /** Message content to publish */
  messageBody: MessageBody;
  /** Client ID of the message sender */
  senderClientId: string;
  /** Array of subscriber client IDs */
  subscriberClientIds: string[];
  /** Project identifier */
  projectId: string;
  /** Api Key identifier */
  keyId: string;
  /** Channel name */
  channelName: string;
  /** Topic name */
  topic: string;
  /** Message sequence number */
  seq: string;
  /** Ingress timestamp for performance tracking */
  tIngress: number;
}

/**
 * Parameters for subscription operations
 */
export interface SubscriptionParams {
  /** Topic to subscribe to */
  topic: string;
  /** Project identifier */
  projectId: string;
  /** Channel name */
  channelName: string;
  /** Client identifier */
  clientId: string;
}

/**
 * Parameters for message retrieval
 */
export interface GetMessagesParams {
  /** Project identifier */
  projectId: string;
  /** Channel name */
  channelName: string;
  /** Topic name */
  topic: string;
  /** Get messages after this sequence (exclusive) */
  afterSeq: string;
  /** Maximum number of messages to return */
  limit?: number;
}

/**
 * Parameters for bulk last-seen updates
 */
export interface UpdateLastSeenParams {
  /** Array of client IDs to update */
  clientIds: string[];
  /** Project identifier */
  projectId: string;
  /** Channel name */
  channelName: string;
  /** Topic name */
  topic: string;
  /** Sequence number to set as last-seen */
  seq: string;
}
