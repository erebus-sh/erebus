/**
 * Erebus PubSub Service Module
 *
 * Core Services:
 * - ErebusPubSubService: Abstract Durable Object base with WebSocket lifecycle
 * - MessageHandler: WebSocket message processing and routing
 * - SubscriptionManager: Client subscription management with in-memory caching
 * - MessageBroadcaster: High-performance message broadcasting with pre-serialization
 * - MessageBuffer: Persistence with TTL, alarm-based cleanup
 * - SequenceManager: ULID sequence generation with caching
 * - ShardManager: Cross-region coordination with cached location/shards
 *
 * Utilities (composition over inheritance):
 * - service-utils: Storage, logging, queue, and client utilities
 * - ack-utils: ACK packet factory functions
 */

// Core Services
export { ErebusPubSubService } from "./ErebusPubSubService";
export { ErebusClient } from "./ErebusClient";
export { MessageHandler } from "./MessageHandler";
export type {
  MessageBroadcastCoordinator,
  BroadcastResult,
} from "./MessageHandler";
export { SubscriptionManager } from "./SubscriptionManager";
export { MessageBroadcaster } from "./MessageBroadcaster";
export { MessageBuffer } from "./MessageBuffer";
export { SequenceManager } from "./SequenceManager";
export { ShardManager } from "./ShardManager";

// Utilities
export {
  createLogger,
  getStorageValue,
  putStorageValue,
  deleteStorageValue,
  listStorage,
  batchPutStorage,
  batchDeleteStorage,
  getErebusClients,
  enqueueUsageEvent,
} from "./service-utils";
export type { Logger } from "./service-utils";

export {
  sendAck,
  createPublishSuccessAck,
  createPublishErrorAck,
  createSubscriptionAck,
} from "./ack-utils";

// Types and Interfaces
export type {
  SocketSendResult,
  MessageRecord,
  MessageMetrics,
  ServiceContext,
  BroadcastConfig,
  StorageKeys,
  WebSocketSendParams,
  PublishMessageParams,
  SubscriptionParams,
  GetMessagesParams,
  UpdateLastSeenParams,
} from "./types";

// Constants and Configuration
export {
  PUBSUB_CONSTANTS,
  DEFAULT_BROADCAST_CONFIG,
  STORAGE_KEYS,
} from "./types";

// Channel
export { ChannelV1 } from "./channel";
