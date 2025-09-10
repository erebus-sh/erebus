import {
  STORAGE_KEYS,
  PUBSUB_CONSTANTS,
  SubscriptionParams,
  ServiceContext,
} from "./types";
import { BaseService } from "./BaseService";
import { ChannelV1 } from "./channel";
import { ErebusClient } from "./ErebusClient";

/**
 * Manages client subscriptions to topics with atomic operations and capacity limits.
 *
 * This service handles:
 * - Adding/removing client subscriptions to topics
 * - Checking subscription status across wildcard and specific topics
 * - Enforcing subscriber limits per topic
 * - Atomic subscription operations using transactions
 * - Bulk operations for performance optimization
 */
export class SubscriptionManager extends BaseService {
  private readonly channel: ChannelV1;

  /**
   * Initialize the SubscriptionManager with required presence update callback.
   *
   * @param serviceContext - Service context containing DO state and environment
   * @param presenceUpdateCallback - Required callback for sending presence updates
   */
  constructor(serviceContext: ServiceContext, channel: ChannelV1) {
    super(serviceContext);
    this.channel = channel;
  }

  /**
   * Subscribe a client to a topic with atomic operations and capacity checks.
   *
   * This method:
   * - Checks current subscriber count against limits
   * - Atomically adds the client to the subscriber list
   * - Always sends presence updates (even for existing subscriptions)
   * - Uses transactions for consistency
   *
   * @param params - Subscription parameters
   * @param selfClient - Optional ErebusClient for self-identification in presence updates
   * @throws Error if topic has reached maximum subscriber capacity
   */
  async subscribeToTopic(
    params: SubscriptionParams,
    selfClient?: ErebusClient,
  ): Promise<void> {
    const { topic, projectId, channelName, clientId } = params;

    this.logDebug(
      `[SUBSCRIBE] Starting subscription - topic: ${topic}, ` +
        `projectId: ${projectId}, channelName: ${channelName}, clientId: ${clientId}`,
    );

    const key = STORAGE_KEYS.subscribers(projectId, channelName, topic);
    this.logDebug(`[SUBSCRIBE] Storage key: ${key}`);

    let wasAlreadySubscribed = false;

    /**
     * Transaction to ensure atomicity of the subscription operation
     * It checks if the client is already subscribed and if the channel has reached the maximum number of subscribers
     */
    await this.transaction(async (txn) => {
      // Get current subscribers within transaction
      const current = (await txn.get<string[]>(key)) ?? [];
      this.logDebug(`[SUBSCRIBE] Current subscribers count: ${current.length}`);

      // Check capacity limits
      if (current.length >= PUBSUB_CONSTANTS.MAX_SUBSCRIBERS_PER_TOPIC) {
        const errorMsg = `Channel capacity exceeded (${PUBSUB_CONSTANTS.MAX_SUBSCRIBERS_PER_TOPIC} subscribers)`;
        this.logError(`[SUBSCRIBE] ${errorMsg}`);
        throw new Error(
          `Channel is full and has more than ${PUBSUB_CONSTANTS.MAX_SUBSCRIBERS_PER_TOPIC} subscribers`,
        );
      }

      // Add client if not already present
      if (!current.includes(clientId)) {
        const updated = [...current, clientId];
        await txn.put(key, updated);
        this.logDebug(
          `[SUBSCRIBE] Client added to subscribers, new count: ${updated.length}`,
        );
        wasAlreadySubscribed = false;
      } else {
        this.logDebug(`[SUBSCRIBE] Client already in subscribers list`);
        wasAlreadySubscribed = true;
      }
    });

    this.logDebug(`[SUBSCRIBE] Subscription transaction completed`);

    // Always send presence update, even if client was already subscribed
    // This handles cases like page refreshes where the client needs to re-establish presence
    this.logDebug(
      `[SUBSCRIBE] Sending presence update to other subscribers (wasAlreadySubscribed: ${wasAlreadySubscribed})`,
    );

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
   * Unsubscribe a client from a topic using atomic operations.
   *
   * @param params - Subscription parameters
   */
  async unsubscribeFromTopic(params: SubscriptionParams): Promise<void> {
    const { topic, projectId, channelName, clientId } = params;

    this.logDebug(
      `[UNSUBSCRIBE] Starting unsubscription - topic: ${topic}, ` +
        `projectId: ${projectId}, channelName: ${channelName}, clientId: ${clientId}`,
    );

    const key = STORAGE_KEYS.subscribers(projectId, channelName, topic);
    this.logDebug(`[UNSUBSCRIBE] Storage key: ${key}`);

    await this.transaction(async (txn) => {
      const current = (await txn.get<string[]>(key)) ?? [];
      this.logDebug(
        `[UNSUBSCRIBE] Current subscribers count: ${current.length}`,
      );

      // Remove client from subscribers
      const updated = current.filter((id) => id !== clientId);
      await txn.put(key, updated);
      this.logDebug(
        `[UNSUBSCRIBE] Client removed from subscribers, new count: ${updated.length}`,
      );
    });

    this.logDebug(`[UNSUBSCRIBE] Unsubscription transaction completed`);

    // Send presence update
    await this.channel.sendPresenceUpdate(
      clientId,
      topic,
      projectId,
      channelName,
      "unsubscribe",
    );
  }

  /**
   * Check if a client is subscribed to a topic.
   *
   * This method checks both specific topic subscriptions and wildcard subscriptions
   * in parallel for optimal performance.
   *
   * @param params - Subscription parameters
   * @returns Promise resolving to true if client is subscribed
   */
  async isSubscribedToTopic(params: SubscriptionParams): Promise<boolean> {
    const { topic, projectId, channelName, clientId } = params;

    this.logDebug(
      `[IS_SUBSCRIBED] Checking subscription - topic: ${topic}, ` +
        `projectId: ${projectId}, channelName: ${channelName}, clientId: ${clientId}`,
    );

    // Check both wildcard (*) and specific topic subscriptions in parallel
    const [wildcardSubscribers, topicSubscribers] = await Promise.all([
      this.getSubscribers(projectId, channelName, "*"),
      this.getSubscribers(projectId, channelName, topic),
    ]);

    this.logDebug(
      `[IS_SUBSCRIBED] Wildcard subscribers: ${wildcardSubscribers.length}, ` +
        `Topic subscribers: ${topicSubscribers.length}`,
    );

    const isSubscribed =
      wildcardSubscribers.includes(clientId) ||
      topicSubscribers.includes(clientId);
    this.logDebug(`[IS_SUBSCRIBED] Final subscription result: ${isSubscribed}`);

    return isSubscribed;
  }

  /**
   * Get all subscribers for a specific topic.
   *
   * @param projectId - Project identifier
   * @param channelName - Channel name
   * @param topic - Topic name (can be '*' for wildcard)
   * @returns Promise resolving to array of subscriber client IDs
   */
  async getSubscribers(
    projectId: string,
    channelName: string,
    topic: string,
  ): Promise<string[]> {
    this.logDebug(`[GET_SUBSCRIBERS] Getting subscribers for topic: ${topic}`);

    const key = STORAGE_KEYS.subscribers(projectId, channelName, topic);
    const subscribers = (await this.getStorageValue<string[]>(key, [])) || [];

    this.logDebug(
      `[GET_SUBSCRIBERS] Found ${subscribers.length} subscribers for key: ${key}`,
    );
    return subscribers;
  }

  /**
   * Get subscriber counts for multiple topics in parallel.
   *
   * @param projectId - Project identifier
   * @param channelName - Channel name
   * @param topics - Array of topic names to check
   * @returns Promise resolving to Map of topic -> subscriber count
   */
  async getSubscriberCounts(
    projectId: string,
    channelName: string,
    topics: string[],
  ): Promise<Map<string, number>> {
    this.logDebug(
      `[GET_SUBSCRIBER_COUNTS] Getting counts for ${topics.length} topics`,
    );

    const counts = new Map<string, number>();

    // Fetch all subscriber lists in parallel
    const subscriberLists = await Promise.all(
      topics.map((topic) => this.getSubscribers(projectId, channelName, topic)),
    );

    // Build counts map
    topics.forEach((topic, index) => {
      counts.set(topic, subscriberLists[index].length);
    });

    this.logDebug(
      `[GET_SUBSCRIBER_COUNTS] Retrieved counts for ${counts.size} topics`,
    );
    return counts;
  }

  /**
   * Bulk unsubscribe a client from multiple topics.
   * Used during client disconnect to clean up all subscriptions efficiently.
   *
   * @param clientId - Client ID to unsubscribe
   * @param projectId - Project identifier
   * @param channelName - Channel name
   * @param topics - Array of topics to unsubscribe from
   * @returns Promise that resolves when all unsubscriptions complete
   */
  async bulkUnsubscribe(
    clientId: string,
    projectId: string,
    channelName: string,
    topics: string[],
  ): Promise<void> {
    this.logDebug(
      `[BULK_UNSUBSCRIBE] Unsubscribing client ${clientId} from ${topics.length} topics`,
    );

    // Process all unsubscriptions in parallel for performance
    await Promise.all(
      topics.map(async (topic) => {
        await this.unsubscribeFromTopic({
          topic,
          projectId,
          channelName,
          clientId,
        });

        // Send presence update
        await this.channel.sendPresenceUpdate(
          clientId,
          topic,
          projectId,
          channelName,
          "unsubscribe",
        );
      }),
    );

    this.logDebug(`[BULK_UNSUBSCRIBE] Bulk unsubscription completed`);
  }

  /**
   * Get all topics that have subscribers in a channel.
   * Useful for administrative and monitoring purposes.
   *
   * @param projectId - Project identifier
   * @param channelName - Channel name
   * @returns Promise resolving to array of active topic names
   */
  async getActiveTopics(
    projectId: string,
    channelName: string,
  ): Promise<string[]> {
    this.logDebug(
      `[GET_ACTIVE_TOPICS] Getting active topics for channel: ${channelName}`,
    );

    const prefix = `subs:${projectId}:${channelName}:`;
    const storage = await this.listStorage({ prefix });

    const topics: string[] = [];
    for (const [key, subscribers] of storage) {
      if (Array.isArray(subscribers) && subscribers.length > 0) {
        // Extract topic from key: subs:projectId:channelName:topic
        const topic = key.slice(prefix.length);
        topics.push(topic);
      }
    }

    this.logDebug(`[GET_ACTIVE_TOPICS] Found ${topics.length} active topics`);
    return topics;
  }

  /**
   * Get total subscriber count across all topics in a channel.
   * Note: This counts unique subscriptions, not unique clients.
   *
   * @param projectId - Project identifier
   * @param channelName - Channel name
   * @returns Promise resolving to total subscription count
   */
  async getTotalSubscriptionCount(
    projectId: string,
    channelName: string,
  ): Promise<number> {
    this.logDebug(
      `[GET_TOTAL_SUBS] Getting total subscription count for channel: ${channelName}`,
    );

    const prefix = `subs:${projectId}:${channelName}:`;
    const storage = await this.listStorage<string[]>({ prefix });

    let totalCount = 0;
    for (const [, subscribers] of storage) {
      if (Array.isArray(subscribers)) {
        totalCount += subscribers.length;
      }
    }

    this.logDebug(`[GET_TOTAL_SUBS] Total subscriptions: ${totalCount}`);
    return totalCount;
  }

  /**
   * Override service name for consistent logging.
   */
  protected getServiceName(): string {
    return "[SUBSCRIPTION_MANAGER]";
  }
}
