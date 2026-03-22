import {
  STORAGE_KEYS,
  PUBSUB_CONSTANTS,
  type SubscriptionParams,
  type ServiceContext,
} from "./types";
import {
  type Logger,
  createLogger,
  getStorageValue,
  putStorageValue,
  listStorage,
} from "./service-utils";
import type { ChannelV1 } from "./channel";
import type { ErebusClient } from "./ErebusClient";

/**
 * Manages client subscriptions to topics with in-memory caching.
 *
 * Key design decisions for Durable Objects single-threaded actor model:
 * - In-memory cache (Map<topic, Set<clientId>>) eliminates redundant storage reads
 * - No transactions needed — single-threaded DO already serializes access
 * - Lazy hydration from storage on first access after hibernation wake
 * - Async persistence after in-memory updates
 */
export class SubscriptionManager {
  private readonly ctx: DurableObjectState;
  private readonly env: ServiceContext["env"];
  private readonly log: Logger;
  private readonly channel: ChannelV1;

  /** In-memory subscription cache: topic key → Set of clientIds */
  private cache = new Map<string, Set<string>>();

  constructor(serviceContext: ServiceContext, channel: ChannelV1) {
    this.ctx = serviceContext.ctx;
    this.env = serviceContext.env;
    this.log = createLogger("[SUBSCRIPTION_MANAGER]", serviceContext.env);
    this.channel = channel;
  }

  /**
   * Subscribe a client to a topic.
   *
   * Updates in-memory Set immediately, persists to storage async.
   * No transaction needed — single-threaded DO.
   */
  async subscribeToTopic(
    params: SubscriptionParams,
    selfClient?: ErebusClient,
  ): Promise<void> {
    const { topic, projectId, channelName, clientId } = params;

    this.log.debug(`[SUBSCRIBE] topic: ${topic}, clientId: ${clientId}`);

    const key = STORAGE_KEYS.subscribers(projectId, channelName, topic);
    const subscribers = await this.getOrHydrate(key);

    // Check capacity
    if (subscribers.size >= PUBSUB_CONSTANTS.MAX_SUBSCRIBERS_PER_TOPIC) {
      this.log.error(
        `[SUBSCRIBE] Channel capacity exceeded (${PUBSUB_CONSTANTS.MAX_SUBSCRIBERS_PER_TOPIC} subscribers)`,
      );
      throw new Error(
        `Channel is full and has more than ${PUBSUB_CONSTANTS.MAX_SUBSCRIBERS_PER_TOPIC} subscribers`,
      );
    }

    // Update in-memory immediately
    subscribers.add(clientId);

    // Persist async — single-threaded DO guarantees no concurrent writes
    await putStorageValue(this.ctx, key, Array.from(subscribers));

    this.log.debug(`[SUBSCRIBE] Client added, count: ${subscribers.size}`);

    // Always send presence update (handles page refreshes)
    await this.channel.sendPresenceUpdate(
      clientId,
      topic,
      projectId,
      channelName,
      "subscribe",
      selfClient,
    );
  }

  /**
   * Unsubscribe a client from a topic.
   *
   * No transaction needed — single-threaded DO.
   */
  async unsubscribeFromTopic(
    params: SubscriptionParams,
    skipPresence = false,
  ): Promise<void> {
    const { topic, projectId, channelName, clientId } = params;

    this.log.debug(`[UNSUBSCRIBE] topic: ${topic}, clientId: ${clientId}`);

    const key = STORAGE_KEYS.subscribers(projectId, channelName, topic);
    const subscribers = await this.getOrHydrate(key);

    subscribers.delete(clientId);
    await putStorageValue(this.ctx, key, Array.from(subscribers));

    this.log.debug(`[UNSUBSCRIBE] Client removed, count: ${subscribers.size}`);

    // Send presence update (unless caller handles it, e.g. bulkUnsubscribe)
    if (!skipPresence) {
      await this.channel.sendPresenceUpdate(
        clientId,
        topic,
        projectId,
        channelName,
        "unsubscribe",
      );
    }
  }

  /**
   * Check if a client is subscribed to a topic.
   * Checks both specific topic and wildcard (*) subscriptions.
   * Pure in-memory operation after first hydration.
   */
  async isSubscribedToTopic(params: SubscriptionParams): Promise<boolean> {
    const { topic, projectId, channelName, clientId } = params;

    const wildcardKey = STORAGE_KEYS.subscribers(projectId, channelName, "*");
    const topicKey = STORAGE_KEYS.subscribers(projectId, channelName, topic);

    const [wildcardSubs, topicSubs] = await Promise.all([
      this.getOrHydrate(wildcardKey),
      this.getOrHydrate(topicKey),
    ]);

    return wildcardSubs.has(clientId) || topicSubs.has(clientId);
  }

  /**
   * Get all subscribers for a specific topic.
   * Returns array for backward compatibility with broadcast code.
   */
  async getSubscribers(
    projectId: string,
    channelName: string,
    topic: string,
  ): Promise<string[]> {
    const key = STORAGE_KEYS.subscribers(projectId, channelName, topic);
    const subscribers = await this.getOrHydrate(key);
    return Array.from(subscribers);
  }

  /**
   * Get subscriber counts for multiple topics in parallel.
   */
  async getSubscriberCounts(
    projectId: string,
    channelName: string,
    topics: string[],
  ): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    const lists = await Promise.all(
      topics.map((topic) => this.getSubscribers(projectId, channelName, topic)),
    );
    topics.forEach((topic, i) => {
      counts.set(topic, lists[i].length);
    });
    return counts;
  }

  /**
   * Bulk unsubscribe a client from multiple topics.
   * Fixed: no longer sends double presence updates.
   */
  async bulkUnsubscribe(
    clientId: string,
    projectId: string,
    channelName: string,
    topics: string[],
  ): Promise<void> {
    this.log.debug(
      `[BULK_UNSUBSCRIBE] client ${clientId} from ${topics.length} topics`,
    );

    // unsubscribeFromTopic already sends presence, so no double-send
    await Promise.all(
      topics.map((topic) =>
        this.unsubscribeFromTopic({
          topic,
          projectId,
          channelName,
          clientId,
        }),
      ),
    );

    this.log.debug(`[BULK_UNSUBSCRIBE] completed`);
  }

  /**
   * Get all topics that have subscribers in a channel.
   */
  async getActiveTopics(
    projectId: string,
    channelName: string,
  ): Promise<string[]> {
    const prefix = `subs:${projectId}:${channelName}:`;
    const storage = await listStorage(this.ctx, { prefix });

    const topics: string[] = [];
    for (const [key, subscribers] of storage) {
      if (Array.isArray(subscribers) && subscribers.length > 0) {
        topics.push(key.slice(prefix.length));
      }
    }
    return topics;
  }

  /**
   * Get total subscriber count across all topics in a channel.
   */
  async getTotalSubscriptionCount(
    projectId: string,
    channelName: string,
  ): Promise<number> {
    const prefix = `subs:${projectId}:${channelName}:`;
    const storage = await listStorage<string[]>(this.ctx, { prefix });

    let total = 0;
    for (const [, subscribers] of storage) {
      if (Array.isArray(subscribers)) {
        total += subscribers.length;
      }
    }
    return total;
  }

  // ── Private helpers ──────────────────────────────────────────────────

  /**
   * Get subscribers from cache, or hydrate from storage on miss.
   * After hibernation wake, cache is empty — first access loads from storage.
   */
  private async getOrHydrate(key: string): Promise<Set<string>> {
    const cached = this.cache.get(key);
    if (cached) return cached;

    // Hydrate from storage
    const stored = (await getStorageValue<string[]>(this.ctx, key, [])) || [];
    const set = new Set(stored);
    this.cache.set(key, set);
    return set;
  }
}
