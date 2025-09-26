// Main orchestrator (new modular version)
export { PubSubConnection } from "./PubSubConnection";

// Main client export
export { ErebusPubSubClient } from "./ErebusPubSubClient";

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

// Typed Helper
export * from "./PubSubFacade";
