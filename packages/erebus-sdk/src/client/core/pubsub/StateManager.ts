import type { ConnectionState, SubscriptionStatus } from "./interfaces";
import { logger } from "@/internal/logger/consola";

/**
 * Manages the overall state of the pub/sub system
 * Consolidates connection state, subscription state, and message processing state
 */
export class StateManager {
  #connectionId: string;
  #connectionState: ConnectionState = "idle";
  #channel: string | null = null;
  #subscriptions = new Map<string, SubscriptionStatus>();
  #processedMessages = new Set<string>();
  #pendingSubscriptions = new Set<string>();
  #handlers = new Map<string, Set<any>>();
  #lastActivity = Date.now();
  #error: Error | null = null;
  #isReconnecting = false;
  #reconnectAttempts = 0;

  constructor(connectionId: string) {
    this.#connectionId = connectionId;
    logger.info(`[${this.#connectionId}] StateManager created`);
  }

  // Connection State Management
  get connectionState(): ConnectionState {
    return this.#connectionState;
  }

  setConnectionState(state: ConnectionState): void {
    logger.info(`[${this.#connectionId}] Connection state changed`, {
      from: this.#connectionState,
      to: state,
    });
    this.#connectionState = state;
    this.#updateActivity();
  }

  get isConnected(): boolean {
    return this.#connectionState === "open";
  }

  get isConnecting(): boolean {
    return this.#connectionState === "connecting";
  }

  get isClosed(): boolean {
    return this.#connectionState === "closed";
  }

  get isIdle(): boolean {
    return this.#connectionState === "idle";
  }

  // Channel Management
  get channel(): string | null {
    return this.#channel;
  }

  setChannel(channel: string): void {
    logger.info(`[${this.#connectionId}] Channel set`, { channel });
    this.#channel = channel;
    this.#updateActivity();
  }

  getChannel(): string | null {
    return this.#channel;
  }

  // Subscription State Management
  get subscriptionCount(): number {
    return this.#subscriptions.size;
  }

  get activeTopics(): string[] {
    return Array.from(this.#subscriptions.entries())
      .filter(([_, status]) => status === "subscribed")
      .map(([topic, _]) => topic);
  }

  get pendingTopics(): string[] {
    return Array.from(this.#subscriptions.entries())
      .filter(([_, status]) => status === "pending")
      .map(([topic, _]) => topic);
  }

  get unsubscribedTopics(): string[] {
    return Array.from(this.#subscriptions.entries())
      .filter(([_, status]) => status === "unsubscribed")
      .map(([topic, _]) => topic);
  }

  setSubscriptionStatus(topic: string, status: SubscriptionStatus): void {
    logger.info(`[${this.#connectionId}] Subscription status updated`, {
      topic,
      status,
    });
    this.#subscriptions.set(topic, status);
    this.#updateActivity();

    // Update pending subscriptions set
    if (status === "subscribed") {
      this.#pendingSubscriptions.delete(topic);
    } else if (status === "pending") {
      this.#pendingSubscriptions.add(topic);
    }
  }

  getSubscriptionStatus(topic: string): SubscriptionStatus {
    return this.#subscriptions.get(topic) || "unsubscribed";
  }

  isSubscribed(topic: string): boolean {
    return this.getSubscriptionStatus(topic) === "subscribed";
  }

  // Message Processing State
  get processedMessagesCount(): number {
    return this.#processedMessages.size;
  }

  addProcessedMessage(messageId: string): void {
    this.#processedMessages.add(messageId);
    this.#updateActivity();

    // Clean up old message IDs to prevent memory leaks (keep last 1000)
    if (this.#processedMessages.size > 1000) {
      const ids = Array.from(this.#processedMessages);
      this.#processedMessages.clear();
      // Keep the most recent 500 IDs
      ids.slice(-500).forEach((id) => this.#processedMessages.add(id));
    }
  }

  isMessageProcessed(messageId: string): boolean {
    return this.#processedMessages.has(messageId);
  }

  clearProcessedMessages(): void {
    logger.info(`[${this.#connectionId}] Clearing processed messages`);
    this.#processedMessages.clear();
  }

  // Handler Management
  get handlerCount(): number {
    let count = 0;
    for (const handlers of this.#handlers.values()) {
      count += handlers.size;
    }
    return count;
  }

  getTopicsWithHandlers(): string[] {
    return Array.from(this.#handlers.keys());
  }

  getHandlerCountForTopic(topic: string): number {
    return this.#handlers.get(topic)?.size || 0;
  }

  addHandler(topic: string, handler: any): void {
    if (!this.#handlers.has(topic)) {
      this.#handlers.set(topic, new Set());
    }
    this.#handlers.get(topic)!.add(handler);
    this.#updateActivity();
  }

  removeHandler(topic: string, handler: any): void {
    const handlers = this.#handlers.get(topic);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.#handlers.delete(topic);
      }
    }
    this.#updateActivity();
  }

  clearHandlers(topic: string): void {
    this.#handlers.delete(topic);
    this.#updateActivity();
  }

  getHandlers(topic: string): Set<any> | undefined {
    return this.#handlers.get(topic);
  }

  // Pending Subscriptions Management
  get pendingSubscriptionsCount(): number {
    return this.#pendingSubscriptions.size;
  }

  addPendingSubscription(topic: string): void {
    this.#pendingSubscriptions.add(topic);
    this.#updateActivity();
  }

  removePendingSubscription(topic: string): void {
    this.#pendingSubscriptions.delete(topic);
    this.#updateActivity();
  }

  clearPendingSubscriptions(): void {
    logger.info(`[${this.#connectionId}] Clearing pending subscriptions`);
    this.#pendingSubscriptions.clear();
  }

  // Error State Management
  get hasError(): boolean {
    return this.#error !== null;
  }

  get error(): Error | null {
    return this.#error;
  }

  setError(error: Error): void {
    logger.error(`[${this.#connectionId}] Error set`, { error });
    this.#error = error;
    this.#updateActivity();
  }

  clearError(): void {
    logger.info(`[${this.#connectionId}] Error cleared`);
    this.#error = null;
    this.#updateActivity();
  }

  // Reconnection State Management
  get isReconnecting(): boolean {
    return this.#isReconnecting;
  }

  setReconnecting(reconnecting: boolean): void {
    this.#isReconnecting = reconnecting;
    this.#updateActivity();
  }

  get reconnectAttempts(): number {
    return this.#reconnectAttempts;
  }

  incrementReconnectAttempts(): void {
    this.#reconnectAttempts++;
    this.#updateActivity();
  }

  resetReconnectAttempts(): void {
    this.#reconnectAttempts = 0;
    this.#updateActivity();
  }

  // Activity Tracking
  get lastActivity(): number {
    return this.#lastActivity;
  }

  #updateActivity(): void {
    this.#lastActivity = Date.now();
  }

  // State Summary and Debugging
  get stateSummary(): {
    connectionState: ConnectionState;
    channel: string | null;
    subscriptionCount: number;
    handlerCount: number;
    processedMessagesCount: number;
    pendingSubscriptionsCount: number;
    hasError: boolean;
    isReconnecting: boolean;
    reconnectAttempts: number;
    lastActivity: number;
  } {
    return {
      connectionState: this.#connectionState,
      channel: this.#channel,
      subscriptionCount: this.subscriptionCount,
      handlerCount: this.handlerCount,
      processedMessagesCount: this.processedMessagesCount,
      pendingSubscriptionsCount: this.pendingSubscriptionsCount,
      hasError: this.hasError,
      isReconnecting: this.#isReconnecting,
      reconnectAttempts: this.#reconnectAttempts,
      lastActivity: this.#lastActivity,
    };
  }

  // Reset and Cleanup
  reset(): void {
    logger.info(`[${this.#connectionId}] Resetting state manager`);
    this.#connectionState = "idle";
    this.#channel = null;
    this.#subscriptions.clear();
    this.#processedMessages.clear();
    this.#pendingSubscriptions.clear();
    this.#handlers.clear();
    this.#error = null;
    this.#isReconnecting = false;
    this.#reconnectAttempts = 0;
    this.#updateActivity();
  }

  clear(): void {
    logger.info(`[${this.#connectionId}] Clearing state manager`);
    this.#subscriptions.clear();
    this.#processedMessages.clear();
    this.#pendingSubscriptions.clear();
    this.#handlers.clear();
    this.#error = null;
    this.#isReconnecting = false;
    this.#reconnectAttempts = 0;
    this.#updateActivity();
  }

  // Debug Methods
  get __debugState(): {
    connectionState: ConnectionState;
    channel: string | null;
    subscriptions: Map<string, SubscriptionStatus>;
    handlers: Map<string, Set<any>>;
    processedMessages: Set<string>;
    pendingSubscriptions: Set<string>;
    error: Error | null;
    isReconnecting: boolean;
    reconnectAttempts: number;
    lastActivity: number;
  } {
    return {
      connectionState: this.#connectionState,
      channel: this.#channel,
      subscriptions: new Map(this.#subscriptions),
      handlers: new Map(this.#handlers),
      processedMessages: new Set(this.#processedMessages),
      pendingSubscriptions: new Set(this.#pendingSubscriptions),
      error: this.#error,
      isReconnecting: this.#isReconnecting,
      reconnectAttempts: this.#reconnectAttempts,
      lastActivity: this.#lastActivity,
    };
  }
}
