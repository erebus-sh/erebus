import type { PacketEnvelope } from "@repo/schemas/packetEnvelope";
import type { MessageBody } from "@repo/schemas/messageBody";
import type { AckCallback } from "../types";
import type { ConnectionConfig } from "./interfaces";

import {
  ConnectionManager,
  BackpressureError,
  NotConnectedError,
} from "./ConnectionManager";
import { AckManager } from "./AckManager";
import { SubscriptionManager } from "./SubscriptionManager";
import { MessageProcessor } from "./MessageProcessor";
import { GrantManager } from "./GrantManager";
import { HeartbeatManager } from "./HeartbeatManager";

// Re-export errors for backward compatibility
export { BackpressureError, NotConnectedError };

/**
 * Main PubSub connection orchestrator that coordinates all subsystems
 */
export class PubSubConnection {
  #connectionManager: ConnectionManager;
  #ackManager: AckManager;
  #subscriptionManager: SubscriptionManager;
  #messageProcessor: MessageProcessor;
  #grantManager: GrantManager;
  #heartbeatManager: HeartbeatManager;

  constructor(config: ConnectionConfig) {
    const connectionId = `conn_${Math.random().toString(36).substring(2, 8)}`;

    // Initialize all managers
    this.#ackManager = new AckManager(connectionId);
    this.#subscriptionManager = new SubscriptionManager(connectionId);
    this.#grantManager = new GrantManager(connectionId, config.tokenProvider);
    this.#messageProcessor = new MessageProcessor(
      connectionId,
      config.onMessage,
      this.#ackManager,
    );
    this.#connectionManager = new ConnectionManager(config);
    this.#heartbeatManager = new HeartbeatManager(
      connectionId,
      config.heartbeatMs ?? 25_000,
      () => this.#sendHeartbeat(),
      config.log ?? (() => {}),
    );
  }

  // Basic getters
  get state() {
    return this.#connectionManager.state;
  }
  get isConnected() {
    return this.#connectionManager.isConnected;
  }
  get channel() {
    return this.#connectionManager.channel;
  }

  // Basic methods
  async open(timeout?: number) {
    await this.#connectionManager.open(timeout);
    this.#heartbeatManager.start();
  }

  close() {
    this.#heartbeatManager.stop();
    this.#ackManager.cleanup("Connection closed");
    this.#connectionManager.close();
  }

  publish(payload: MessageBody) {
    this.#connectionManager.send({
      packetType: "publish",
      topic: payload.topic,
      payload,
      clientMsgId: payload.clientMsgId || "default",
    });
  }

  publishWithAck(
    payload: MessageBody,
    callback: AckCallback,
    timeoutMs = 30000,
  ) {
    // Implementation here
  }

  private #sendHeartbeat() {
    // Heartbeat implementation
  }
}
