// TODO: later no barrel exports

// New modular exports (recommended)
export {
  PubSubConnection,
  ErebusPubSubClientNew,
  ConnectionManager,
  AckManager,
  SubscriptionManager,
  MessageProcessor,
  GrantManager,
  HeartbeatManager,
  BackpressureError,
  NotConnectedError,
} from "./client/core/pubsub";

// Legacy exports (deprecated, use modular versions above)
export { ErebusPubSubClient } from "./client/core/pubsub/ErebusPubSub";

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
