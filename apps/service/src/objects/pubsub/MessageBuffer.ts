import { MessageBody } from '@repo/schemas';
import { MessageRecord, STORAGE_KEYS, PUBSUB_CONSTANTS, GetMessagesParams, UpdateLastSeenParams } from './types';
import { BaseService } from './BaseService';

/**
 * Manages message buffering, persistence, and retrieval with TTL support.
 *
 * This service handles:
 * - Persisting messages to Durable Object storage with TTL metadata
 * - Retrieving messages after a specific sequence for catch-up
 * - Lazy expiration cleanup during read/write operations
 * - Last-seen sequence tracking for clients
 * - Bulk operations for performance optimization
 *
 * Messages are stored with embedded TTL to avoid Redis dependency.
 * ULID sequences provide lexicographic ordering for chronological retrieval.
 */
export class MessageBuffer extends BaseService {
	/**
	 * Buffer a message to storage with TTL metadata and trigger opportunistic cleanup.
	 *
	 * Messages are stored with a wrapper containing:
	 * - body: The original message
	 * - exp: Expiration timestamp for TTL enforcement
	 *
	 * @param packet - Message body to buffer
	 * @param projectId - Project identifier
	 * @param channelName - Channel name
	 * @param topic - Topic name
	 * @param seq - Message sequence (ULID)
	 * @returns Promise that resolves when buffering and cleanup complete
	 */
	async bufferMessage(packet: MessageBody, projectId: string, channelName: string, topic: string, seq: string): Promise<void> {
		this.logVerbose(`[BUFFER_MESSAGE] Starting message buffering - topic: ${topic}, seq: ${seq}`);

		// Create message record with TTL metadata
		const messageKey = STORAGE_KEYS.message(projectId, channelName, topic, seq);
		const exp = Date.now() + PUBSUB_CONSTANTS.MESSAGE_TTL_MS;
		const record: MessageRecord = { body: packet, exp };

		this.logVerbose(`[BUFFER_MESSAGE] Storage key: ${messageKey}, expires at: ${new Date(exp).toISOString()}`);

		// Store message with TTL wrapper
		await this.putStorageValue(messageKey, JSON.stringify(record));
		this.logVerbose(`[BUFFER_MESSAGE] Message stored successfully`);

		// Trigger opportunistic cleanup asynchronously
		this.logVerbose(`[BUFFER_MESSAGE] Starting opportunistic prune`);
		await this.pruneExpiredMessages(projectId, channelName, topic);
		this.logVerbose(`[BUFFER_MESSAGE] Prune completed`);
	}

	/**
	 * Retrieve messages for a topic after a specific sequence with TTL enforcement.
	 *
	 * This method:
	 * - Lists messages by prefix (lexicographically ordered by ULID)
	 * - Filters messages after the specified sequence
	 * - Enforces TTL and lazily deletes expired messages
	 * - Returns messages in chronological order (oldest to newest)
	 *
	 * @param params - Parameters for message retrieval
	 * @returns Promise resolving to array of messages in chronological order
	 */
	async getMessagesAfter(params: GetMessagesParams): Promise<MessageBody[]> {
		const { projectId, channelName, topic, afterSeq, limit = PUBSUB_CONSTANTS.DEFAULT_MESSAGE_LIMIT } = params;

		this.logDebug(`[GET_MESSAGES] Retrieving messages after seq: ${afterSeq}, topic: ${topic}, limit: ${limit}`);

		const prefix = `msg:${projectId}:${channelName}:${topic}:`;
		const messages: MessageBody[] = [];
		const now = Date.now();

		this.logDebug(`[GET_MESSAGES] Listing messages with prefix: ${prefix}`);

		// List messages for this topic (ULID keys are lexicographically sortable)
		const iter = await this.listStorage<string>({
			prefix,
			limit: PUBSUB_CONSTANTS.DEFAULT_STORAGE_LIST_LIMIT,
		});

		this.logDebug(`[GET_MESSAGES] Found ${iter.size} total messages`);

		let processedCount = 0;
		let expiredCount = 0;
		let skippedCount = 0;

		// Process messages in chronological order (ULID keys are naturally ordered)
		for (const [key, value] of iter) {
			const seq = key.slice(prefix.length);

			// Skip messages that are not strictly after the requested sequence
			if (afterSeq && seq <= afterSeq) {
				skippedCount++;
				continue;
			}

			try {
				const record = this.parseMessageRecord(value);
				if (!record) {
					skippedCount++;
					continue;
				}

				// Check TTL and lazily delete expired messages
				if (record.exp < now) {
					await this.deleteStorageValue(key);
					expiredCount++;
					this.logVerbose(`[GET_MESSAGES] Deleted expired message: ${key}`);
					continue;
				}

				// Add valid message to results
				const body: MessageBody = record.body;
				messages.push(body);
				processedCount++;

				// Respect limit
				if (messages.length >= limit) {
					break;
				}
			} catch (error) {
				this.logError(`[GET_MESSAGES] Error processing message ${key}: ${error}`);
				skippedCount++;
			}
		}

		this.logDebug(
			`[GET_MESSAGES] Retrieval summary - processed: ${processedCount}, ` +
				`expired: ${expiredCount}, skipped: ${skippedCount}, returned: ${messages.length}`,
		);

		return messages;
	}

	/**
	 * Update last-seen sequence for multiple clients atomically.
	 *
	 * This method:
	 * - Uses transactions for atomic read-modify-write operations
	 * - Ensures sequences only move forward (never regress)
	 * - Handles bulk updates efficiently
	 * - Maintains consistency under concurrent access
	 *
	 * @param params - Parameters for bulk last-seen updates
	 */
	async updateLastSeenBulk(params: UpdateLastSeenParams): Promise<void> {
		const { clientIds, projectId, channelName, topic, seq } = params;

		this.logDebug(`[UPDATE_LAST_SEEN] Starting bulk update - clientCount: ${clientIds.length}, ` + `topic: ${topic}, seq: ${seq}`);

		// Skip empty client lists
		if (clientIds.length === 0) {
			this.logDebug(`[UPDATE_LAST_SEEN] No clients to update, skipping`);
			return;
		}

		await this.transaction(async (txn) => {
			// Generate storage keys for all clients
			const keys = clientIds.map((clientId) => STORAGE_KEYS.lastSeenSequence(projectId, channelName, topic, clientId));

			this.logDebug(`[UPDATE_LAST_SEEN] Generated ${keys.length} storage keys`);

			// Read current values within transaction context
			const currentValues = await Promise.all(keys.map((key) => txn.get<string>(key)));

			this.logDebug(`[UPDATE_LAST_SEEN] Retrieved current values`);

			// Prepare updates (only advance sequences, never regress)
			const updates: Array<{ key: string; value: string }> = [];
			for (let i = 0; i < keys.length; i++) {
				const current = (currentValues[i] as string | undefined) ?? '0';

				// Only update if new sequence is greater (ULID lexicographic ordering)
				if (current < seq) {
					updates.push({ key: keys[i], value: seq });
				}
			}

			// Apply all updates atomically within the transaction
			if (updates.length > 0) {
				await Promise.all(updates.map(({ key, value }) => txn.put(key, value)));
				this.logDebug(`[UPDATE_LAST_SEEN] Updated ${updates.length} out of ${keys.length} clients`);
			} else {
				this.logDebug(`[UPDATE_LAST_SEEN] No updates needed - all clients already at or ahead of sequence`);
			}
		});

		this.logDebug(`[UPDATE_LAST_SEEN] Bulk update transaction completed`);
	}

	/**
	 * Update last-seen sequence for a single client by delegating to bulk updater.
	 *
	 * @param projectId - Project identifier
	 * @param channelName - Channel name
	 * @param topic - Topic name
	 * @param clientId - Client identifier
	 * @param seq - Sequence number to set as last-seen
	 */
	async updateLastSeenSingle(projectId: string, channelName: string, topic: string, clientId: string, seq: string): Promise<void> {
		this.logDebug(`[UPDATE_LAST_SEEN] Single update - clientId: ${clientId}, topic: ${topic}, seq: ${seq}`);
		await this.updateLastSeenBulk({ clientIds: [clientId], projectId, channelName, topic, seq });
	}

	/**
	 * Get the last-seen sequence for a specific client and topic.
	 *
	 * @param projectId - Project identifier
	 * @param channelName - Channel name
	 * @param topic - Topic name
	 * @param clientId - Client identifier
	 * @returns Promise resolving to the last-seen sequence (or '0' if none)
	 */
	async getLastSeen(projectId: string, channelName: string, topic: string, clientId: string): Promise<string> {
		this.logDebug(`[GET_LAST_SEEN] Getting last seen - clientId: ${clientId}, topic: ${topic}`);

		const key = STORAGE_KEYS.lastSeenSequence(projectId, channelName, topic, clientId);
		const current = (await this.getStorageValue<string>(key, '0')) || '0';

		this.logDebug(`[GET_LAST_SEEN] Last seen sequence: ${current} for key: ${key}`);
		return current;
	}

	/**
	 * Delete expired messages for a topic using lazy cleanup strategy.
	 *
	 * This method:
	 * - Lists messages by prefix (limited to prevent long stalls)
	 * - Checks TTL for each message
	 * - Deletes expired messages
	 * - Provides metrics for monitoring
	 *
	 * @param projectId - Project identifier
	 * @param channelName - Channel name
	 * @param topic - Topic name
	 * @returns Promise that resolves when pruning is complete
	 */
	async pruneExpiredMessages(projectId: string, channelName: string, topic: string): Promise<void> {
		this.logVerbose(`[PRUNE_MESSAGES] Starting prune - topic: ${topic}`);

		const prefix = `msg:${projectId}:${channelName}:${topic}:`;
		const now = Date.now();

		this.logVerbose(`[PRUNE_MESSAGES] Pruning prefix: ${prefix}, current time: ${now}`);

		// List messages with limit to avoid long stalls
		const iter = await this.listStorage<string>({
			prefix,
			limit: PUBSUB_CONSTANTS.PRUNE_LIMIT_PER_ITERATION,
		});

		this.logVerbose(`[PRUNE_MESSAGES] Found ${iter.size} messages to check`);

		let deletedCount = 0;
		for (const [key, value] of iter) {
			try {
				const record = this.parseMessageRecord(value);
				if (record && record.exp < now) {
					await this.deleteStorageValue(key);
					deletedCount++;
					this.logVerbose(`[PRUNE_MESSAGES] Deleted expired message: ${key}`);
				}
			} catch (error) {
				this.logVerbose(`[PRUNE_MESSAGES] Error processing message ${key}: ${error}`);
			}
		}

		// Log summary in normal debug mode
		if (this.env.DEBUG) {
			console.log(`[MESSAGE_BUFFER] [PRUNE_MESSAGES] Prune completed - deleted: ${deletedCount} messages`);
		}
	}

	/**
	 * Get message count for a topic (including expired messages).
	 * Useful for monitoring and administrative purposes.
	 *
	 * @param projectId - Project identifier
	 * @param channelName - Channel name
	 * @param topic - Topic name
	 * @returns Promise resolving to message count
	 */
	async getMessageCount(projectId: string, channelName: string, topic: string): Promise<number> {
		const prefix = `msg:${projectId}:${channelName}:${topic}:`;
		const iter = await this.listStorage({ prefix });

		this.logDebug(`[GET_MESSAGE_COUNT] Topic ${topic} has ${iter.size} messages`);
		return iter.size;
	}

	/**
	 * Parse message record from storage, handling both new and legacy formats.
	 *
	 * @param value - Raw storage value
	 * @returns Parsed message record or null if invalid
	 */
	private parseMessageRecord(value: string): MessageRecord | null {
		try {
			const parsed = JSON.parse(value);
			if (!parsed || typeof parsed !== 'object') {
				return null;
			}

			// Handle new format with TTL wrapper
			if (parsed.body && typeof parsed.exp === 'number') {
				return parsed as MessageRecord;
			}

			// Handle legacy format (direct message body)
			if (parsed.sentAt || parsed.topic) {
				// Convert legacy format to new format with default TTL
				return {
					body: parsed as MessageBody,
					exp: Date.now() + PUBSUB_CONSTANTS.MESSAGE_TTL_MS,
				};
			}

			return null;
		} catch (error) {
			this.logError(`[PARSE_MESSAGE_RECORD] Failed to parse message record: ${error}`);
			return null;
		}
	}

	/**
	 * Override service name for consistent logging.
	 */
	protected getServiceName(): string {
		return '[MESSAGE_BUFFER]';
	}
}
