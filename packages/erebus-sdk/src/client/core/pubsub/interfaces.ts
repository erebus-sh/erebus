import type {
  PacketEnvelope,
  AckPacketType,
} from "@repo/schemas/packetEnvelope";
import type { PendingPublish, PendingSubscription } from "../types";

/**
 * Basic connection states
 */
export type ConnectionState = "idle" | "connecting" | "open" | "closed";

/**
 * Subscription status for tracking
 */
export type SubscriptionStatus = "subscribed" | "unsubscribed" | "pending";

/**
 * Message callback type for received packets
 */
export type OnMessage = (msg: PacketEnvelope) => void;

/**
 * Handler function type for topic subscriptions
 */
export type MessageHandler = (msg: PacketEnvelope) => void | Promise<void>;

/**
 * Logging callback type
 */
export type Logger = (
  l: "info" | "warn" | "error",
  msg: string,
  meta?: unknown,
) => void;

/**
 * Grant/Token provider function type
 */
export type TokenProvider = (channel: string) => Promise<string>;

/**
 * Basic connection configuration
 */
export interface ConnectionConfig {
  url: string;
  channel: string;
  tokenProvider: TokenProvider;
  heartbeatMs?: number;
  onMessage: OnMessage;
  log?: Logger;
  autoReconnect?: boolean;
  debugHexDump?: boolean;
}

/**
 * Basic open options
 */
export interface OpenOptions {
  timeout?: number;
  grant: string;
}

/**
 * Connection management interface
 */
export interface IConnectionManager {
  readonly state: ConnectionState;
  readonly isConnected: boolean;
  readonly isConnecting: boolean;
  readonly isClosed: boolean;
  readonly isIdle: boolean;
  readonly connectionId: string;
  readonly url: string;
  readonly bufferedAmount: number;
  readonly readyState: number | undefined;

  open(options: OpenOptions): Promise<void>;
  close(): void;
  send(packet: PacketEnvelope): void;
  sendRaw(data: string): void;
  setChannel(channel: string): void;
}

/**
 * ACK management interface
 */
export interface IAckManager {
  trackPublish(requestId: string, pending: PendingPublish): void;
  trackSubscription(requestId: string, pending: PendingSubscription): void;
  handleAck(ackPacket: AckPacketType): void;
  handlePublishTimeout(requestId: string): void;
  handleSubscriptionTimeout(requestId: string): void;
  cleanup(reason: string): void;
  getPendingCount(): number;
  getPendingSubscriptionCount(): number;
}

/**
 * Subscription management interface
 */
export interface ISubscriptionManager {
  readonly subscriptions: string[];
  readonly subscribedTopics: string[];
  readonly unsubscribedTopics: string[];
  readonly subscriptionCount: number;

  subscribe(topic: string): void;
  unsubscribe(topic: string): void;
  isSubscribed(topic: string): boolean;
  getSubscriptionStatus(topic: string): SubscriptionStatus;
  clear(): void;
  getSubscriptionTracking(): {
    subscribed: string[];
    unsubscribed: string[];
    pending: string[];
  };
}

/**
 * Grant/Token management interface
 */
export interface IGrantManager {
  getCachedGrant(): string | undefined;
  setCachedGrant(token: string): void;
  clearCachedGrant(): void;
  getToken(channel: string): Promise<string>;
}

/**
 * Heartbeat management interface
 */
export interface IHeartbeatManager {
  start(): void;
  stop(): void;
  readonly isRunning: boolean;
}

/**
 * Message processing interface
 */
export interface IMessageProcessor {
  processMessage(data: string): Promise<PacketEnvelope | null>;
  handlePacket(packet: PacketEnvelope): Promise<void>;
}

/**
 * State management interface
 */
export interface IStateManager {
  readonly connectionState: ConnectionState;
  readonly isConnected: boolean;
  readonly isConnecting: boolean;
  readonly isClosed: boolean;
  readonly isIdle: boolean;
  readonly channel: string | null;
  readonly subscriptionCount: number;
  readonly handlerCount: number;
  readonly processedMessagesCount: number;
  readonly pendingSubscriptionsCount: number;
  readonly hasError: boolean;
  readonly isReconnecting: boolean;
  readonly reconnectAttempts: number;
  readonly lastActivity: number;

  setConnectionState(state: ConnectionState): void;
  setChannel(channel: string): void;
  setSubscriptionStatus(topic: string, status: SubscriptionStatus): void;
  getSubscriptionStatus(topic: string): SubscriptionStatus;
  isSubscribed(topic: string): boolean;
  addProcessedMessage(messageId: string): void;
  isMessageProcessed(messageId: string): boolean;
  addHandler(topic: string, handler: MessageHandler): void;
  removeHandler(topic: string, handler: MessageHandler): void;
  clearHandlers(topic: string): void;
  getHandlers(topic: string): Set<MessageHandler> | undefined;
  addPendingSubscription(topic: string): void;
  removePendingSubscription(topic: string): void;
  setError(error: Error): void;
  clearError(): void;
  setReconnecting(reconnecting: boolean): void;
  incrementReconnectAttempts(): void;
  resetReconnectAttempts(): void;
  reset(): void;
  clear(): void;
}

/**
 * Connection health information
 */
export interface ConnectionHealth {
  state: string;
  isConnected: boolean;
  isReadable: boolean;
  isWritable: boolean;
  channel: string;
  subscriptionCount: number;
  readyState: number | undefined;
  bufferedAmount: number;
  connectionId: string;
  url: string;
}
