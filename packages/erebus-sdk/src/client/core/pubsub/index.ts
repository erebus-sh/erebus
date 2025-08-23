// Main orchestrator
export {
  PubSubConnection,
  BackpressureError,
  NotConnectedError,
} from "./PubSubConnectionNew";

// Individual managers (for advanced use cases)
export { ConnectionManager } from "./ConnectionManager";
export { AckManager } from "./AckManager";
export { SubscriptionManager } from "./SubscriptionManager";
export { MessageProcessor } from "./MessageProcessor";
export { GrantManager } from "./GrantManager";
export { HeartbeatManager } from "./HeartbeatManager";

// Interfaces and types
export type * from "./interfaces";

// For backward compatibility, also export the original classes
export { ErebusPubSubClient } from "./ErebusPubSub";

// Legacy connection (will be deprecated)
export { PubSubConnection as PubSubConnectionLegacy } from "./pubsubConnection";
