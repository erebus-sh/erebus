/**
 * Erebus PubSub Service Module
 *
 * This module provides a comprehensive set of services for building scalable,
 * real-time publish-subscribe systems on Cloudflare Durable Objects.
 *
 * Core Services:
 * - ErebusPubSubService: Abstract base class with common functionality
 * - MessageHandler: WebSocket message processing and routing
 * - SubscriptionManager: Client subscription and topic management
 * - MessageBroadcaster: High-performance message broadcasting
 * - MessageBuffer: Persistence, buffering, and message retrieval
 * - SequenceManager: ULID sequence generation and ordering
 * - ShardManager: Cross-region coordination and routing
 *
 * Types and Configuration:
 * - Comprehensive TypeScript interfaces and types
 * - Default configurations and constants
 * - Storage key generators and utilities
 */

// Core Services
export { ErebusPubSubService } from "./ErebusPubSubService";
export { BaseService } from "./BaseService";
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

/**
 * Re-export the refactored ChannelV1 class
 */
export { ChannelV1 } from "./channel";
