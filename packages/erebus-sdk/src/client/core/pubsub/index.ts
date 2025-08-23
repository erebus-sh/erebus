// Main orchestrator (new modular version)
export {
  PubSubConnection,
  BackpressureError,
  NotConnectedError,
} from "./PubSubConnectionNew";

// New modular client
export { ErebusPubSubClientNew } from "./ErebusPubSubClientNew";

// Individual managers (for advanced use cases)
export { ConnectionManager } from "./ConnectionManager";
export { AckManager } from "./AckManager";
export { SubscriptionManager } from "./SubscriptionManager";
export { MessageProcessor } from "./MessageProcessor";
export { GrantManager } from "./GrantManager";
export { HeartbeatManager } from "./HeartbeatManager";

// Interfaces and types
export type * from "./interfaces";

// Legacy exports (will be deprecated)
export { ErebusPubSubClient } from "./ErebusPubSub";
export { PubSubConnection as PubSubConnectionLegacy } from "./pubsubConnection";
