// TODO: later no barrel exports

// Main client exports
export { ErebusPubSubClient, PubSubConnection } from "./client/core/pubsub";

// Modular components (for advanced use cases)
export {
  ConnectionManager,
  AckManager,
  SubscriptionManager,
  MessageProcessor,
  GrantManager,
  HeartbeatManager,
  BackpressureError,
  NotConnectedError,
} from "./client/core/pubsub";

export type {
  ErebusOptions,
  Unsubscribe,
  MessageMeta,
  AckCallback,
  AckResponse,
  AckSuccess,
  AckError,
  PendingPublish,
} from "./client/core/types";

// New modular types
export type {
  ConnectionConfig,
  ConnectionHealth,
  ConnectionState,
  SubscriptionStatus,
  IConnectionManager,
  IAckManager,
  ISubscriptionManager,
  IGrantManager,
  IHeartbeatManager,
  IMessageProcessor,
} from "./client/core/pubsub";

export { AuthError } from "./client/core/errors";
