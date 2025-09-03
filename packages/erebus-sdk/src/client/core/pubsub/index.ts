// Main orchestrator (new modular version)
export {
  PubSubConnection,
  BackpressureError,
  NotConnectedError,
} from "./PubSubConnection";

// Main client export
export { ErebusPubSubClientNew as ErebusPubSubClient } from "./ErebusPubSubClient";

// Individual managers (for advanced use cases)
export { ConnectionManager } from "./ConnectionManager";
export { AckManager } from "./AckManager";
export { SubscriptionManager } from "./SubscriptionManager";
export { MessageProcessor } from "./MessageProcessor";
export { GrantManager } from "./GrantManager";
export { HeartbeatManager } from "./HeartbeatManager";
export { StateManager } from "./StateManager";
export { PresenceManager } from "./Presence";
export type { PresenceHandler } from "./Presence";

// Interfaces and types
export type * from "./interfaces";

// Legacy exports removed - use the modular architecture above
