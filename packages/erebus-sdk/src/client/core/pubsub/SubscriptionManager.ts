import { logger } from "@/internal/logger/consola";

import type { ISubscriptionManager, SubscriptionStatus } from "./interfaces";

/**
 * Manages topic subscriptions and optimistic subscription tracking
 */
export class SubscriptionManager implements ISubscriptionManager {
  #subs = new Set<string>();
  #subscribedTopics = new Set<string>();
  #unsubscribedTopics = new Set<string>();
  #connectionId: string;

  constructor(connectionId: string) {
    this.#connectionId = connectionId;
    logger.info(`[${this.#connectionId}] SubscriptionManager created`);
  }

  // Getters
  get subscriptions(): string[] {
    return Array.from(this.#subs);
  }

  get subscribedTopics(): string[] {
    return Array.from(this.#subscribedTopics).filter(
      (topic) => !this.#unsubscribedTopics.has(topic),
    );
  }

  get unsubscribedTopics(): string[] {
    return Array.from(this.#unsubscribedTopics);
  }

  get subscriptionCount(): number {
    return this.#subs.size;
  }

  subscribe(topic: string): boolean {
    logger.info(`[${this.#connectionId}] Subscribe to topic`, { topic });

    // Validate topic
    if (!topic || typeof topic !== "string" || topic.trim().length === 0) {
      const error = "Invalid topic: must be a non-empty string";
      logger.error(`[${this.#connectionId}] ${error}`, { topic });
      throw new Error(error);
    }

    // Optimistically mark as subscribed
    this.#subscribedTopics.add(topic);
    this.#unsubscribedTopics.delete(topic); // Remove from unsubscribed if it was there

    // Check if the topic is already subscribed
    if (this.#subs.has(topic)) {
      logger.info(`[${this.#connectionId}] Topic already subscribed`, {
        topic,
      });
      return false; // already subscribed
    }

    this.#subs.add(topic);
    logger.info(`[${this.#connectionId}] Topic added to subscriptions`, {
      topic,
      totalSubs: this.#subs.size,
    });

    return true;
  }

  unsubscribe(topic: string): boolean {
    logger.info(`[${this.#connectionId}] Unsubscribe from topic`, { topic });

    // Validate topic
    if (!topic || typeof topic !== "string" || topic.trim().length === 0) {
      const error = "Invalid topic: must be a non-empty string";
      logger.error(`[${this.#connectionId}] ${error}`, { topic });
      throw new Error(error);
    }

    // Check if the topic is already unsubscribed
    if (!this.#subs.has(topic)) {
      logger.info(`[${this.#connectionId}] Topic already unsubscribed`, {
        topic,
      });
      return false; // already unsubscribed
    }

    // Optimistically mark as unsubscribed
    this.#unsubscribedTopics.add(topic);
    this.#subscribedTopics.delete(topic); // Remove from subscribed

    this.#subs.delete(topic);
    logger.info(`[${this.#connectionId}] Topic removed from subscriptions`, {
      topic,
      totalSubs: this.#subs.size,
    });

    return true;
  }

  isSubscribed(topic: string): boolean {
    return (
      this.#subscribedTopics.has(topic) && !this.#unsubscribedTopics.has(topic)
    );
  }

  getSubscriptionStatus(topic: string): SubscriptionStatus {
    if (
      this.#subscribedTopics.has(topic) &&
      !this.#unsubscribedTopics.has(topic)
    ) {
      return "subscribed";
    } else if (this.#unsubscribedTopics.has(topic)) {
      return "unsubscribed";
    } else {
      return "pending";
    }
  }

  clear(): void {
    logger.info(`[${this.#connectionId}] Clearing all subscriptions`);
    this.#subs.clear();
    this.#subscribedTopics.clear();
    this.#unsubscribedTopics.clear();
  }

  getSubscriptionTracking(): {
    subscribed: string[];
    unsubscribed: string[];
    pending: string[];
  } {
    const pending = Array.from(this.#subs).filter(
      (topic) =>
        !this.#subscribedTopics.has(topic) &&
        !this.#unsubscribedTopics.has(topic),
    );

    return {
      subscribed: this.subscribedTopics,
      unsubscribed: this.unsubscribedTopics,
      pending,
    };
  }

  /**
   * Get all topics that should be resubscribed on reconnect
   */
  getTopicsForResubscription(): string[] {
    return Array.from(this.#subs);
  }

  /**
   * Update subscription status based on server confirmation
   */
  confirmSubscription(topic: string): void {
    logger.info(`[${this.#connectionId}] Confirming subscription`, { topic });
    this.#subscribedTopics.add(topic);
    this.#unsubscribedTopics.delete(topic);
  }

  /**
   * Update subscription status based on server confirmation
   */
  confirmUnsubscription(topic: string): void {
    logger.info(`[${this.#connectionId}] Confirming unsubscription`, { topic });
    this.#unsubscribedTopics.add(topic);
    this.#subscribedTopics.delete(topic);
    this.#subs.delete(topic);
  }
}
