import type { MessageBody } from "@repo/schemas/messageBody";
import {
  type MessageRecord,
  STORAGE_KEYS,
  PUBSUB_CONSTANTS,
  type GetMessagesParams,
  type UpdateLastSeenParams,
  type ServiceContext,
} from "./types";
import {
  type Logger,
  createLogger,
  getStorageValue,
  putStorageValue,
  deleteStorageValue,
  listStorage,
  batchDeleteStorage,
  batchPutStorage,
} from "./service-utils";

/**
 * Manages message buffering, persistence, and retrieval with TTL support.
 *
 * Key design decisions for Durable Objects single-threaded actor model:
 * - No transactions needed for single-threaded DO
 * - Batch storage operations (up to 128 keys per call)
 * - TTL cleanup delegated to DO alarm (not inline during reads/writes)
 * - Expired messages skipped during reads but NOT deleted inline
 */
export class MessageBuffer {
  private readonly ctx: DurableObjectState;
  private readonly env: ServiceContext["env"];
  private readonly log: Logger;

  /** Track whether a cleanup alarm is already scheduled */
  private alarmScheduled = false;

  constructor(serviceContext: ServiceContext) {
    this.ctx = serviceContext.ctx;
    this.env = serviceContext.env;
    this.log = createLogger("[MESSAGE_BUFFER]", serviceContext.env);
  }

  /**
   * Buffer a message to storage with TTL metadata.
   * Schedules alarm-based cleanup instead of inline pruning.
   */
  async bufferMessage(
    packet: MessageBody,
    projectId: string,
    channelName: string,
    topic: string,
    seq: string,
  ): Promise<void> {
    this.log.verbose(`[BUFFER_MESSAGE] topic: ${topic}, seq: ${seq}`);

    const messageKey = STORAGE_KEYS.message(projectId, channelName, topic, seq);
    const exp = Date.now() + PUBSUB_CONSTANTS.MESSAGE_TTL_MS;
    const record: MessageRecord = { body: packet, exp };

    await putStorageValue(this.ctx, messageKey, JSON.stringify(record));

    // Enforce per-topic cap by deleting oldest keys beyond the limit
    await this.enforceMaxBufferedMessages(projectId, channelName, topic);

    // Schedule alarm-based cleanup instead of inline pruning
    await this.scheduleCleanupAlarm();
  }

  /**
   * Schedule a cleanup alarm if one isn't already pending.
   * The alarm handler is in ChannelV1.alarm().
   */
  async scheduleCleanupAlarm(): Promise<void> {
    if (this.alarmScheduled) return;

    const currentAlarm = await this.ctx.storage.getAlarm();
    if (currentAlarm === null) {
      // Schedule cleanup 60 seconds from now
      await this.ctx.storage.setAlarm(Date.now() + 60_000);
      this.alarmScheduled = true;
      this.log.debug(`[SCHEDULE_ALARM] Cleanup alarm scheduled`);
    }
  }

  /**
   * Run TTL cleanup — called from ChannelV1.alarm().
   * Batch-deletes expired messages across all topics.
   */
  async runTtlCleanup(): Promise<void> {
    this.log.debug(`[TTL_CLEANUP] Starting alarm-based cleanup`);
    this.alarmScheduled = false;

    const prefix = "msg:";
    const now = Date.now();
    const iter = await listStorage<string>(this.ctx, {
      prefix,
      limit: PUBSUB_CONSTANTS.DEFAULT_STORAGE_LIST_LIMIT,
    });

    const expiredKeys: string[] = [];
    for (const [key, value] of iter) {
      try {
        const record = this.parseMessageRecord(value);
        if (record && record.exp < now) {
          expiredKeys.push(key);
        }
      } catch {
        // Skip malformed records
      }
    }

    if (expiredKeys.length > 0) {
      // Batch delete (up to 128 per call)
      for (let i = 0; i < expiredKeys.length; i += 128) {
        const batch = expiredKeys.slice(i, i + 128);
        await batchDeleteStorage(this.ctx, batch);
      }
      this.log.debug(
        `[TTL_CLEANUP] Deleted ${expiredKeys.length} expired messages`,
      );
    }

    // Reschedule if there are remaining messages
    if (iter.size > expiredKeys.length) {
      await this.ctx.storage.setAlarm(Date.now() + 60_000);
      this.alarmScheduled = true;
    }
  }

  /**
   * Enforce maximum buffered messages per topic by trimming oldest.
   * Uses batch delete for efficiency.
   */
  private async enforceMaxBufferedMessages(
    projectId: string,
    channelName: string,
    topic: string,
  ): Promise<void> {
    const prefix = STORAGE_KEYS.messagePrefix(projectId, channelName, topic);
    const limit = PUBSUB_CONSTANTS.MAX_BUFFERED_MESSAGES_PER_TOPIC;

    const iter = await listStorage<string>(this.ctx, {
      prefix,
      limit: PUBSUB_CONSTANTS.DEFAULT_STORAGE_LIST_LIMIT,
    });

    const total = iter.size;
    if (total <= limit) return;

    const toDelete = total - limit;
    const keysToDelete: string[] = [];
    for (const [key] of iter) {
      keysToDelete.push(key);
      if (keysToDelete.length >= toDelete) break;
    }

    if (keysToDelete.length > 0) {
      await batchDeleteStorage(this.ctx, keysToDelete);
      this.log.debug(
        `[ENFORCE_MAX] topic=${topic} deleted=${keysToDelete.length}`,
      );
    }
  }

  /**
   * Retrieve messages after a specific sequence.
   * Skips expired messages without deleting (alarm handles cleanup).
   */
  async getMessagesAfter(params: GetMessagesParams): Promise<MessageBody[]> {
    const {
      projectId,
      channelName,
      topic,
      afterSeq,
      limit = PUBSUB_CONSTANTS.DEFAULT_MESSAGE_LIMIT,
    } = params;

    return this._getMessages({
      projectId,
      channelName,
      topic,
      boundarySeq: afterSeq,
      isAfter: true,
      limit,
    });
  }

  /**
   * Retrieve messages before a specific sequence.
   */
  async getMessagesBefore(params: GetMessagesParams): Promise<MessageBody[]> {
    const {
      projectId,
      channelName,
      topic,
      beforeSeq,
      limit = PUBSUB_CONSTANTS.DEFAULT_MESSAGE_LIMIT,
    } = params;

    return this._getMessages({
      projectId,
      channelName,
      topic,
      boundarySeq: beforeSeq,
      isAfter: false,
      limit,
    });
  }

  /**
   * Internal message retrieval with shared logic.
   * Expired messages are skipped but NOT deleted inline (alarm handles cleanup).
   */
  private async _getMessages(params: {
    projectId: string;
    channelName: string;
    topic: string;
    boundarySeq?: string;
    isAfter: boolean;
    limit: number;
  }): Promise<MessageBody[]> {
    const { projectId, channelName, topic, boundarySeq, isAfter, limit } =
      params;

    const prefix = STORAGE_KEYS.messagePrefix(projectId, channelName, topic);
    const messages: MessageBody[] = [];
    const now = Date.now();

    const iter = await listStorage<string>(this.ctx, {
      prefix,
      limit: PUBSUB_CONSTANTS.DEFAULT_STORAGE_LIST_LIMIT,
    });

    const entries = Array.from(iter);
    const processOrder = isAfter ? entries : entries.reverse();

    for (const [key, value] of processOrder) {
      const seq = key.slice(prefix.length);

      // Apply sequence filtering
      if (boundarySeq) {
        if (isAfter && seq <= boundarySeq) continue;
        if (!isAfter && seq >= boundarySeq) continue;
      }

      try {
        const record = this.parseMessageRecord(value);
        if (!record) continue;

        // Skip expired but don't delete inline — alarm handles cleanup
        if (record.exp < now) continue;

        messages.push(record.body);
        if (messages.length >= limit) break;
      } catch {
        // Skip malformed records
      }
    }

    this.log.debug(`[GET_MESSAGES] topic=${topic} returned=${messages.length}`);
    return messages;
  }

  /**
   * Update last-seen sequence for multiple clients.
   *
   * No transaction needed in single-threaded DO.
   * Uses batch put for efficiency.
   */
  async updateLastSeenBulk(params: UpdateLastSeenParams): Promise<void> {
    const { clientIds, projectId, channelName, topic, seq } = params;

    if (clientIds.length === 0) return;

    // Read all current values
    const keys = clientIds.map((clientId) =>
      STORAGE_KEYS.lastSeenSequence(projectId, channelName, topic, clientId),
    );

    const currentValues = await Promise.all(
      keys.map((key) => getStorageValue<string>(this.ctx, key, "0")),
    );

    // Build batch update — only advance sequences, never regress
    const updates: Record<string, string> = {};
    for (let i = 0; i < keys.length; i++) {
      const current = currentValues[i] ?? "0";
      if (current < seq) {
        updates[keys[i]] = seq;
      }
    }

    if (Object.keys(updates).length > 0) {
      await batchPutStorage(this.ctx, updates);
      this.log.debug(
        `[UPDATE_LAST_SEEN] Updated ${Object.keys(updates).length} of ${keys.length} clients`,
      );
    }
  }

  /**
   * Update last-seen sequence for a single client.
   */
  async updateLastSeenSingle(
    projectId: string,
    channelName: string,
    topic: string,
    clientId: string,
    seq: string,
  ): Promise<void> {
    await this.updateLastSeenBulk({
      clientIds: [clientId],
      projectId,
      channelName,
      topic,
      seq,
    });
  }

  /**
   * Get the last-seen sequence for a specific client and topic.
   */
  async getLastSeen(
    projectId: string,
    channelName: string,
    topic: string,
    clientId: string,
  ): Promise<string> {
    const key = STORAGE_KEYS.lastSeenSequence(
      projectId,
      channelName,
      topic,
      clientId,
    );
    return (await getStorageValue<string>(this.ctx, key, "0")) || "0";
  }

  /**
   * Get message count for a topic (including expired messages).
   */
  async getMessageCount(
    projectId: string,
    channelName: string,
    topic: string,
  ): Promise<number> {
    const prefix = `msg:${projectId}:${channelName}:${topic}:`;
    const iter = await listStorage(this.ctx, { prefix });
    return iter.size;
  }

  /**
   * Parse message record from storage, handling both new and legacy formats.
   */
  private parseMessageRecord(value: string): MessageRecord | null {
    try {
      const parsed = JSON.parse(value);
      if (!parsed || typeof parsed !== "object") return null;

      // New format with TTL wrapper
      if (parsed.body && typeof parsed.exp === "number") {
        return parsed as MessageRecord;
      }

      // Legacy format (direct message body)
      if (parsed.sentAt || parsed.topic) {
        return {
          body: parsed as MessageBody,
          exp: Date.now() + PUBSUB_CONSTANTS.MESSAGE_TTL_MS,
        };
      }

      return null;
    } catch {
      return null;
    }
  }
}
