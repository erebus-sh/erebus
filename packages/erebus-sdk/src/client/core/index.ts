// ========== MAIN CLIENT ==========
export {
  ErebusClient,
  ErebusClientState,
  type ErebusClientOptions,
} from "./Erebus";

// ========== PUBSUB CLIENT ==========
export { ErebusPubSubClient, PubSubConnection } from "./pubsub";

// ========== PUBSUB MANAGERS ==========
export {
  ConnectionManager,
  AckManager,
  SubscriptionManager,
  MessageProcessor,
  GrantManager,
  HeartbeatManager,
  StateManager,
  PresenceManager,
} from "./pubsub";

// ========== CORE TYPES ==========
export type {
  ErebusOptions,
  MessageMeta,
  Unsubscribe,
  AckSuccess,
  AckError,
  AckResponse,
  AckCallback,
  SubscriptionSuccess,
  SubscriptionError,
  SubscriptionResponse,
  SubscriptionCallback,
  PendingPublish,
  PendingSubscription,
  Presence,
} from "./types";

// ========== PUBSUB TYPES & INTERFACES ==========
export type {
  PresenceHandler,
  ConnectionState,
  SubscriptionStatus,
  OnMessage,
  MessageHandler,
  Logger,
  TokenProvider,
  ConnectionConfig,
  OpenOptions,

  // Manager interfaces
  IConnectionManager,
  IAckManager,
  ISubscriptionManager,
  IGrantManager,
  IHeartbeatManager,
  IMessageProcessor,
  IStateManager,
  ConnectionHealth,
} from "./pubsub";

// ========== AUTHORIZATION ==========
export { Authorize } from "./authorize";

// ========== WIRE PROTOCOL ==========
export { encodeEnvelope, parseServerFrame, parseMessageBody } from "./wire";

// ========== UTILITIES ==========
export { safeJsonParse } from "./utils";
export { backoff } from "./backoff";

// ========== ENVIRONMENT ==========
export { isBrowser, isProd } from "./env";

// ========== ERRORS ==========
export {
  NotConnectedError,
  BackpressureError,
  AuthError,
  logError,
} from "./errors";
