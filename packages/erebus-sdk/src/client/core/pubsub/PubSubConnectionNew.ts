import type { PacketEnvelope } from "@repo/schemas/packetEnvelope";
import type { MessageBody } from "@repo/schemas/messageBody";
import type { AckCallback, PendingPublish } from "../types";
import type {
  ConnectionConfig,
  ConnectionHealth,
  ConnectionState,
  SubscriptionStatus,
} from "./interfaces";

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
import { logger } from "@/internal/logger/consola";
import consola from "consola";

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
  #ackTimeoutMs = 30000; // 30 seconds timeout for ACKs
  #connectionId: string;

  constructor(config: ConnectionConfig) {
    this.#connectionId = `conn_${Math.random().toString(36).substring(2, 8)}`;
    logger.info(`[${this.#connectionId}] PubSubConnection constructor called`, {
      url: config.url,
      heartbeatMs: config.heartbeatMs ?? 25_000,
    });

    // Initialize all managers
    this.#ackManager = new AckManager(this.#connectionId);
    this.#subscriptionManager = new SubscriptionManager(this.#connectionId);
    this.#grantManager = new GrantManager(
      this.#connectionId,
      config.tokenProvider,
    );

    // Create message processor with ACK handling
    this.#messageProcessor = new MessageProcessor(
      this.#connectionId,
      config.onMessage,
      this.#ackManager,
    );

    // Create connection manager with message processing
    const connectionConfig: ConnectionConfig = {
      ...config,
      onMessage: async (rawMessage: PacketEnvelope & { rawData?: string }) => {
        // Handle the message processing
        if (rawMessage.rawData) {
          await this.#messageProcessor.processMessage(rawMessage.rawData);
        } else {
          // Direct packet handling for already parsed messages
          await this.#messageProcessor.handlePacket(rawMessage);
        }
      },
    };

    this.#connectionManager = new ConnectionManager(connectionConfig);

    // Create heartbeat manager
    this.#heartbeatManager = new HeartbeatManager(
      this.#connectionId,
      config.heartbeatMs ?? 25_000,
      () => this.#sendHeartbeat(),
      config.log ?? (() => {}),
    );

    logger.info(`[${this.#connectionId}] PubSubConnection initialized`);
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

    // Add grant to the connection URL
    const connectUrl = new URL(this.#connectionManager.url);
    connectUrl.searchParams.set("grant", grantJWT);

    // Open connection
    await this.#connectionManager.open(timeout);

    // Send connect packet
    this.#connectionManager.send({ packetType: "connect", grantJWT });

    // Start heartbeat
    this.#heartbeatManager.start();

    // Resubscribe to existing topics
    const topicsToResubscribe =
      this.#subscriptionManager.getTopicsForResubscription();
    for (const topic of topicsToResubscribe) {
      logger.info(`[${this.#connectionId}] Resubscribing to topic`, { topic });
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
    logger.info(`[${this.#connectionId}] Subscribe called`, { topic });

    this.#subscriptionManager.subscribe(topic);

    if (this.isConnected) {
      logger.info(
        `[${this.#connectionId}] Connection open, sending subscribe packet`,
        { topic },
      );
      try {
        this.#connectionManager.send({ packetType: "subscribe", topic });
      } catch (error) {
        logger.error(`[${this.#connectionId}] Error sending subscribe packet`, {
          error,
          topic,
        });
        // Revert the subscription on send failure
        this.#subscriptionManager.unsubscribe(topic);
        throw error;
      }
    } else {
      logger.info(
        `[${this.#connectionId}] Connection not open, subscription will be sent when connected`,
        { topic },
      );
    }
  }

  unsubscribe(topic: string): void {
    logger.info(`[${this.#connectionId}] Unsubscribe called`, { topic });

    this.#subscriptionManager.unsubscribe(topic);

    if (this.isConnected) {
      logger.info(
        `[${this.#connectionId}] Connection open, sending unsubscribe packet`,
        { topic },
      );
      try {
        this.#connectionManager.send({ packetType: "unsubscribe", topic });
      } catch (error) {
        logger.error(
          `[${this.#connectionId}] Error sending unsubscribe packet`,
          {
            error,
            topic,
          },
        );
        // Don't rethrow - we've already removed from subscriptions
      }
    } else {
      logger.info(
        `[${this.#connectionId}] Connection not open, unsubscription will be sent when connected`,
        { topic },
      );
    }
  }

  publish(payload: MessageBody): void {
    this.#publishInternal(payload, false);
  }

  publishWithAck(
    payload: MessageBody,
    callback: AckCallback,
    timeoutMs: number = this.#ackTimeoutMs,
  ): void {
    this.#publishInternal(payload, true, callback, timeoutMs);
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

  #publishInternal(
    payload: MessageBody,
    withAck: boolean = false,
    callback?: AckCallback,
    timeoutMs?: number,
  ): void {
    logger.info(`[${this.#connectionId}] Publish called`, {
      topic: payload.topic,
      withAck,
    });

    // Validate payload
    if (!payload || typeof payload !== "object") {
      const error = "Invalid payload: must be an object";
      logger.error(`[${this.#connectionId}] ${error}`, { payload });
      throw new Error(error);
    }

    if (withAck && !callback) {
      const error = "ACK callback is required when withAck is true";
      logger.error(`[${this.#connectionId}] ${error}`);
      throw new Error(error);
    }

    if (!this.isConnected) {
      logger.error(`[${this.#connectionId}] Cannot publish - not connected`, {
        state: this.state,
      });
      throw new NotConnectedError("Not connected");
    }

    // Generate client correlation fields
    let clientMsgId: string = `fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
          clientMsgId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }
        Object.assign(payload, { clientMsgId });
      }

      // Generate requestId for ACK tracking
      if (withAck && callback) {
        requestId =
          crypto?.randomUUID?.() ||
          `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

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
            this.#ackManager.handleTimeout(requestId!);
          }, timeoutMs);
        }

        this.#ackManager.trackPublish(requestId, pending);
      }
    } catch (err) {
      // Ensure fallback is set
      Object.assign(payload, { clientMsgId });
      logger.warn(
        `[${this.#connectionId}] Error setting client fields, using fallback`,
        { err, clientMsgId },
      );
    }

    logger.info(`[${this.#connectionId}] Publishing message`, {
      topic: payload.topic,
      withAck,
      requestId,
      clientMsgId,
    });

    consola.info(
      `[PubSubConnection] [${this.#connectionId}] Publishing message`,
      {
        topic: payload.topic,
        withAck,
      },
    );

    try {
      this.#connectionManager.send({
        packetType: "publish",
        ack: withAck,
        requestId,
        topic: payload.topic,
        payload,
        clientMsgId: clientMsgId!,
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

      logger.error(`[${this.#connectionId}] Error publishing message`, {
        error,
        topic: payload.topic,
      });
      throw error;
    }
  }

  #sendHeartbeat(): void {
    if (!this.isConnected) {
      logger.debug(
        `[${this.#connectionId}] Skipping heartbeat - not connected`,
      );
      return;
    }

    try {
      // Heartbeats are raw ping strings, not packet envelopes
      this.#connectionManager.sendRaw("ping");
    } catch (error) {
      logger.error(`[${this.#connectionId}] Error sending heartbeat`, {
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
