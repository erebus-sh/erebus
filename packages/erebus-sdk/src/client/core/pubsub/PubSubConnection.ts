import type { MessageBody } from "../../../../../schemas/messageBody";
import type { PacketEnvelope } from "../../../../../schemas/packetEnvelope";
import { nanoid } from "nanoid";

import {
  type AckCallback,
  type PendingPublish,
  type SubscriptionCallback,
  type PendingSubscription,
  VERSION,
} from "../types";
import { AckManager } from "./AckManager";
import {
  ConnectionManager,
  BackpressureError,
  NotConnectedError,
} from "./ConnectionManager";
import { GrantManager } from "./GrantManager";
import { HeartbeatManager } from "./HeartbeatManager";
import { MessageProcessor } from "./MessageProcessor";
import { PresenceManager } from "./Presence";
import type { PresenceHandler } from "./Presence";
import { SubscriptionManager } from "./SubscriptionManager";
import type {
  ConnectionConfig,
  ConnectionHealth,
  ConnectionState,
  SubscriptionStatus,
} from "./interfaces";

import type { StateManager } from "./StateManager";

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
  #presenceManager: PresenceManager;
  #ackTimeoutMs = 30000; // 30 seconds timeout for ACKs
  #connectionId: string;
  #stateManager?: StateManager;

  constructor(config: ConnectionConfig) {
    this.#connectionId = `conn_${Math.random().toString(36).slice(2, 8)}`;
    console.log(`[${this.#connectionId}] PubSubConnection constructor called`, {
      url: config.url,
      heartbeatMs: config.heartbeatMs ?? 25_000,
    });

    // Initialize all managers
    this.#ackManager = new AckManager(this.#connectionId);
    this.#subscriptionManager = new SubscriptionManager(this.#connectionId);
    this.#presenceManager = new PresenceManager(this.#connectionId);
    this.#grantManager = new GrantManager(
      this.#connectionId,
      config.tokenProvider,
    );

    // Create message processor with ACK and presence handling
    this.#messageProcessor = new MessageProcessor(
      this.#connectionId,
      config.onMessage,
      this.#ackManager,
      this.#presenceManager,
    );

    // Create connection manager with message processing and state change callback

    const connectionConfig: ConnectionConfig & {
      onStateChange?: (state: ConnectionState) => void;
      onError?: (error: Error) => void;
    } = {
      ...config,
      onMessage: (rawMessage: PacketEnvelope & { rawData?: string }): void => {
        // Handle the message processing
        if (rawMessage.rawData) {
          this.#messageProcessor.processMessage(rawMessage.rawData);
        } else {
          // Direct packet handling for already parsed messages
          this.#messageProcessor.handlePacket(rawMessage);
        }
      },
      onStateChange: (state: ConnectionState): void => {
        // Synchronize state with StateManager if available
        if (this.#stateManager) {
          this.#stateManager.setConnectionState(state);
        }
      },
      onError: (error: Error): void => {
        // Synchronize error with StateManager if available
        if (this.#stateManager) {
          this.#stateManager.setError(error);
        }
      },
    };

    this.#connectionManager = new ConnectionManager(connectionConfig);

    // Create heartbeat manager
    this.#heartbeatManager = new HeartbeatManager(
      this.#connectionId,
      config.heartbeatMs ?? 25_000,
      (): void => this.#sendHeartbeat(),
      config.log ?? ((): void => {}),
    );

    console.log(`[${this.#connectionId}] PubSubConnection initialized`);
  }

  // Connection state getters
  get state(): ConnectionState {
    return this.#connectionManager.state;
  }

  get isConnected(): boolean {
    return this.#connectionManager.isConnected;
  }

  get isConnecting(): boolean {
    return this.#connectionManager.isConnecting;
  }

  get isClosed(): boolean {
    return this.#connectionManager.isClosed;
  }

  get isIdle(): boolean {
    return this.#connectionManager.isIdle;
  }

  get isReadable(): boolean {
    return this.#connectionManager.isConnected;
  }

  get isWritable(): boolean {
    return this.#connectionManager.isConnected;
  }

  get channel(): string {
    return this.#connectionManager.channel;
  }

  get subscriptionCount(): number {
    return this.#subscriptionManager.subscriptionCount;
  }

  get subscriptions(): string[] {
    return this.#subscriptionManager.subscriptions;
  }

  get readyState(): number | undefined {
    return this.#connectionManager.readyState;
  }

  get bufferedAmount(): number {
    return this.#connectionManager.bufferedAmount;
  }

  get connectionId(): string {
    return this.#connectionManager.connectionId;
  }

  get url(): string {
    return this.#connectionManager.url;
  }

  get connectionHealth(): ConnectionHealth {
    return {
      state: this.state,
      isConnected: this.isConnected,
      isReadable: this.isReadable,
      isWritable: this.isWritable,
      channel: this.channel,
      subscriptionCount: this.subscriptionCount,
      readyState: this.readyState,
      bufferedAmount: this.bufferedAmount,
      connectionId: this.connectionId,
      url: this.url,
    };
  }

  get subscribedTopics(): string[] {
    return this.#subscriptionManager.subscribedTopics;
  }

  get unsubscribedTopics(): string[] {
    return this.#subscriptionManager.unsubscribedTopics;
  }

  get subscriptionTracking(): {
    subscribed: string[];
    unsubscribed: string[];
    pending: string[];
  } {
    return this.#subscriptionManager.getSubscriptionTracking();
  }

  async open(timeout?: number): Promise<void> {
    // Get grant token before opening connection
    const grantJWT = await this.#grantManager.getTokenWithCache(this.channel);

    // Open connection with grant and timeout
    await this.#connectionManager.open({
      grant: grantJWT,
      timeout: timeout,
    });

    // Send connect packet
    this.#connectionManager.send({
      packetType: "connect",
      version: VERSION,
      grantJWT,
    });

    // Start heartbeat
    this.#heartbeatManager.start();

    // Resubscribe to existing topics
    const topicsToResubscribe =
      this.#subscriptionManager.getTopicsForResubscription();
    for (const topic of topicsToResubscribe) {
      console.log(`[${this.#connectionId}] Resubscribing to topic`, { topic });
      this.#connectionManager.send({ packetType: "subscribe", topic });
    }
  }

  close(): void {
    // Stop heartbeat first
    this.#heartbeatManager.stop();

    // Clean up pending ACK callbacks
    this.#ackManager.cleanup("Connection closed");

    // Close connection
    this.#connectionManager.close();

    // Clear subscriptions
    this.#subscriptionManager.clear();

    // Clear cached grant
    this.#grantManager.clearCachedGrant();
  }

  subscribe(topic: string): void {
    this.subscribeWithCallback(topic);
  }

  subscribeWithCallback(
    topic: string,
    callback?: SubscriptionCallback,
    timeoutMs?: number,
  ): void {
    console.log(`[${this.#connectionId}] Subscribe called`, {
      topic,
      hasCallback: !!callback,
      timeout: timeoutMs,
    });

    // Return false if already subscribed
    if (!this.#subscriptionManager.subscribe(topic)) {
      console.log(`[${this.#connectionId}] Topic already subscribed`, {
        topic,
      });
      return;
    }

    if (!this.isConnected) {
      console.log(
        `[${this.#connectionId}] Connection not open, subscription will be sent when connected`,
        { topic },
      );
      return;
    }

    console.log(
      `[${this.#connectionId}] Connection open, sending subscribe packet`,
      { topic },
    );
    try {
      let requestId: string | undefined;
      let clientMsgId: string | undefined;

      // Set up ACK tracking if callback provided
      if (callback) {
        requestId = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        // Optional clientMsgId for subscription tracking
        if (
          typeof crypto !== "undefined" &&
          typeof crypto.randomUUID === "function"
        ) {
          clientMsgId = crypto.randomUUID();
        }

        const pending: PendingSubscription = {
          requestId,
          clientMsgId,
          topic,
          path: "subscribe",
          callback,
          timestamp: Date.now(),
        };

        // Set timeout for subscription ACK response
        if (timeoutMs && timeoutMs > 0) {
          pending.timeoutId = setTimeout(() => {
            this.#ackManager.handleSubscriptionTimeout(requestId!);
          }, timeoutMs);
        }

        this.#ackManager.trackSubscription(requestId, pending);
      }

      this.#connectionManager.send({
        packetType: "subscribe",
        topic,
        ...(requestId && { requestId }),
        ...(clientMsgId && { clientMsgId }),
      });
    } catch (error) {
      console.error(`[${this.#connectionId}] Error sending subscribe packet`, {
        error,
        topic,
      });
      // Revert the subscription on send failure
      this.#subscriptionManager.unsubscribe(topic);
      throw error;
    }
  }

  unsubscribe(topic: string): void {
    this.unsubscribeWithCallback(topic);
  }

  unsubscribeWithCallback(
    topic: string,
    callback?: SubscriptionCallback,
    timeoutMs?: number,
  ): void {
    console.log(`[${this.#connectionId}] Unsubscribe called`, {
      topic,
      hasCallback: !!callback,
      timeout: timeoutMs,
    });

    if (!this.#subscriptionManager.unsubscribe(topic)) {
      console.log(`[${this.#connectionId}] Topic already unsubscribed`, {
        topic,
      });
      return;
    }

    if (this.isConnected) {
      console.log(
        `[${this.#connectionId}] Connection open, sending unsubscribe packet`,
        { topic },
      );
      try {
        let requestId: string | undefined;
        let clientMsgId: string | undefined;

        // Set up ACK tracking if callback provided
        if (callback) {
          requestId = `unsub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

          // Optional clientMsgId for subscription tracking
          if (
            typeof crypto !== "undefined" &&
            typeof crypto.randomUUID === "function"
          ) {
            clientMsgId = crypto.randomUUID();
          }

          const pending: PendingSubscription = {
            requestId,
            clientMsgId,
            topic,
            path: "unsubscribe",
            callback,
            timestamp: Date.now(),
          };

          // Set timeout for subscription ACK response
          if (timeoutMs && timeoutMs > 0) {
            pending.timeoutId = setTimeout(() => {
              this.#ackManager.handleSubscriptionTimeout(requestId!);
            }, timeoutMs);
          }

          this.#ackManager.trackSubscription(requestId, pending);
        }

        this.#connectionManager.send({
          packetType: "unsubscribe",
          topic,
          ...(requestId && { requestId }),
          ...(clientMsgId && { clientMsgId }),
        });
      } catch (error) {
        console.error(
          `[${this.#connectionId}] Error sending unsubscribe packet`,
          {
            error,
            topic,
          },
        );
        // Don't rethrow - we've already removed from subscriptions
      }
    } else {
      console.log(
        `[${this.#connectionId}] Connection not open, unsubscription will be sent when connected`,
        { topic },
      );
    }
  }

  publish(payload: MessageBody): void {
    // Ignore the returned clientMsgId for regular publish (no ACK)
    void this.#publishInternal(payload, false);
  }

  publishWithAck(
    payload: MessageBody,
    callback: AckCallback,
    timeoutMs: number = this.#ackTimeoutMs,
  ): Promise<string> {
    return this.#publishInternal(payload, true, callback, timeoutMs);
  }

  isSubscribed(topic: string): boolean {
    return this.#subscriptionManager.isSubscribed(topic);
  }

  getSubscriptionStatus(topic: string): SubscriptionStatus {
    return this.#subscriptionManager.getSubscriptionStatus(topic);
  }

  setChannel(channel: string): void {
    this.#connectionManager.setChannel(channel);
    // Clear cached grant when channel changes
    this.#grantManager.clearCachedGrant();
  }

  /**
   * Set the StateManager reference for state synchronization
   * @param stateManager - The StateManager instance to synchronize with
   */
  setStateManager(stateManager: import("./StateManager").StateManager): void {
    this.#stateManager = stateManager;
    // Immediately sync current state
    this.#stateManager.setConnectionState(this.#connectionManager.state);
  }

  /**
   * Register a presence handler for a specific topic
   * @param topic - The topic to listen for presence updates on
   * @param handler - The callback function to handle presence updates
   */
  onPresence(topic: string, handler: PresenceHandler): void {
    this.#presenceManager.onPresence(topic, handler);
  }

  /**
   * Remove a presence handler for a specific topic
   * @param topic - The topic to remove the handler from
   * @param handler - The specific handler function to remove
   */
  offPresence(topic: string, handler: PresenceHandler): void {
    this.#presenceManager.offPresence(topic, handler);
  }

  /**
   * Remove all presence handlers for a specific topic
   * @param topic - The topic to clear all handlers for
   */
  clearPresenceHandlers(topic: string): void {
    this.#presenceManager.clearPresenceHandlers(topic);
  }

  #publishInternal(
    payload: MessageBody,
    withAck: boolean = false,
    callback?: AckCallback,
    timeoutMs?: number,
  ): Promise<string> {
    console.log(`[${this.#connectionId}] Publish called`, {
      topic: payload.topic,
      withAck,
    });

    // Validate payload
    if (!payload || typeof payload !== "object") {
      const error = "Invalid payload: must be an object";
      console.error(`[${this.#connectionId}] ${error}`, { payload });
      throw new Error(error);
    }

    if (withAck && !callback) {
      const error = "ACK callback is required when withAck is true";
      console.error(`[${this.#connectionId}] ${error}`);
      throw new Error(error);
    }

    if (!this.isConnected) {
      console.error(`[${this.#connectionId}] Cannot publish - not connected`, {
        state: this.state,
      });
      throw new NotConnectedError("Not connected");
    }

    // Generate client correlation fields
    let clientMsgId: string = `fallback_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    let requestId: string | undefined;

    try {
      // Ensure client correlation fields exist
      if (!payload.clientPublishTs) {
        Object.assign(payload, { clientPublishTs: Date.now() });
      }

      // Generate or use existing clientMsgId
      if (payload.clientMsgId) {
        clientMsgId = payload.clientMsgId;
      } else {
        if (
          typeof crypto !== "undefined" &&
          typeof crypto.randomUUID === "function"
        ) {
          clientMsgId = crypto.randomUUID();
        } else {
          clientMsgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        }
        Object.assign(payload, { clientMsgId });
      }

      // Generate requestId for ACK tracking
      if (withAck && callback) {
        requestId = `req_${Date.now()}_${nanoid()}`;

        // Set up ACK tracking
        const pending: PendingPublish = {
          requestId,
          clientMsgId,
          topic: payload.topic,
          callback,
          timestamp: Date.now(),
        };

        // Set timeout for ACK response
        if (timeoutMs && timeoutMs > 0) {
          pending.timeoutId = setTimeout(() => {
            this.#ackManager.handlePublishTimeout(requestId!);
          }, timeoutMs);
        }

        this.#ackManager.trackPublish(requestId, pending);
      }
    } catch (err) {
      // Ensure fallback is set
      Object.assign(payload, { clientMsgId });
      console.warn(
        `[${this.#connectionId}] Error setting client fields, using fallback`,
        { err, clientMsgId },
      );
    }

    console.log(`[${this.#connectionId}] Publishing message`, {
      topic: payload.topic,
      withAck,
      requestId,
      clientMsgId,
    });

    console.log(
      `[PubSubConnection] [${this.#connectionId}] Publishing message`,
      {
        topic: payload.topic,
        withAck,
      },
    );

    try {
      // Server primarily uses payload.topic, but schema requires topic at envelope level too
      this.#connectionManager.send({
        packetType: "publish",
        topic: payload.topic,
        ack: withAck,
        payload,
        clientMsgId: clientMsgId,
        ...(withAck && requestId && { requestId }), // Only include requestId for ACK tracking
      });
    } catch (error) {
      // Clean up ACK tracking on send failure
      if (withAck && requestId) {
        const pending = this.#ackManager.getPendingCount();
        if (pending > 0) {
          // This is a simplified cleanup - in practice the ACK manager
          // would handle cleanup for the specific requestId
        }
      }

      console.error(`[${this.#connectionId}] Error publishing message`, {
        error,
        topic: payload.topic,
      });
      throw error;
    }

    return Promise.resolve(clientMsgId);
  }

  #sendHeartbeat(): void {
    if (!this.isConnected) {
      console.log(`[${this.#connectionId}] Skipping heartbeat - not connected`);
      return;
    }

    try {
      // Heartbeats are raw ping strings, not packet envelopes
      this.#connectionManager.sendRaw("ping");
    } catch (error) {
      console.error(`[${this.#connectionId}] Error sending heartbeat`, {
        error,
      });
      // Close connection to trigger reconnect
      this.#connectionManager.close();
      throw error;
    }
  }

  // Debug methods for development
  get __debugObject(): unknown {
    return {
      connectionManager: this.#connectionManager,
      ackManager: this.#ackManager,
      subscriptionManager: this.#subscriptionManager,
      messageProcessor: this.#messageProcessor,
      grantManager: this.#grantManager,
      heartbeatManager: this.#heartbeatManager,
    };
  }

  /**
   * Development-only state getter
   * @returns The current state of the connection
   */
  get __debugState(): string {
    return this.#connectionManager.state;
  }
}
