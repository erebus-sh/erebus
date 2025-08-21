import { monotonicFactory, decodeTime, ULIDFactory } from "ulid";
import { hashStringToSeed } from "@/lib/hash";
import { seededRandom } from "@/lib/seed";
import { monoNow } from "@/lib/monotonic";
import { STORAGE_KEYS } from "./types";
import { BaseService } from "./BaseService";

/**
 * Manages ULID sequence generation and persistence for topics.
 *
 * This service handles:
 * - Generating monotonic ULID sequences for message ordering
 * - Persisting sequences to Durable Object storage
 * - Ensuring temporal ordering and uniqueness
 * - Topic-specific seeded randomness for deterministic generation
 *
 * ULIDs provide:
 * - 128-bit IDs with millisecond precision timestamps
 * - Lexicographic sortability for chronological ordering
 * - Collision resistance with per-topic seeded randomness
 */
export class SequenceManager extends BaseService {
  /**
   * Generate a new sequence number for a topic and persist it to storage.
   *
   * This method:
   * - Retrieves the last sequence from storage
   * - Generates a monotonic ULID using topic-specific seeded randomness
   * - Ensures temporal ordering (never goes backwards in time)
   * - Persists the new sequence to storage
   *
   * @param projectId - Project identifier
   * @param channelName - Channel name
   * @param topic - Topic name for sequence generation
   * @returns Promise resolving to the new sequence number (ULID)
   */
  async generateSequence(
    projectId: string,
    channelName: string,
    topic: string,
  ): Promise<string> {
    const startTime = monoNow();
    this.logDebug(
      `[GENERATE_SEQ] Starting sequence generation for topic: ${topic}`,
    );

    // Read last sequence from storage (hibernation-compatible, no caching)
    const storageKey = STORAGE_KEYS.sequence(projectId, channelName, topic);
    const lastSeqStored = await this.getStorageValue<string>(storageKey);

    this.logDebug(`[GENERATE_SEQ] Last stored sequence: ${lastSeqStored}`);

    // Create topic-specific ULID factory with seeded randomness for consistency
    const seed = hashStringToSeed(topic);
    const ulidFactory = monotonicFactory(seededRandom(seed)) as ULIDFactory;

    let newSeq: string;

    if (!lastSeqStored || lastSeqStored === "0") {
      // First sequence for this topic
      newSeq = ulidFactory();
      this.logDebug(`[GENERATE_SEQ] Generated first sequence: ${newSeq}`);
    } else {
      // Generate monotonic sequence ensuring we never go backwards in time
      const lastTime = decodeTime(lastSeqStored);
      const now = Date.now();

      // Use the maximum of last timestamp and current time for strict ordering
      const nextTime = Math.max(lastTime, now);
      newSeq = ulidFactory(nextTime);

      this.logDebug(
        `[GENERATE_SEQ] Generated monotonic sequence: ${newSeq} ` +
          `(lastTime: ${lastTime}, now: ${now}, nextTime: ${nextTime})`,
      );
    }

    // Persist the new sequence to storage
    await this.persistSequence(projectId, channelName, topic, newSeq);

    const duration = monoNow() - startTime;
    this.logDebug(
      `[GENERATE_SEQ] Sequence generation completed in ${duration.toFixed(2)}ms`,
    );

    return newSeq;
  }

  /**
   * Persist a sequence number to storage.
   *
   * This operation can be called asynchronously and includes proper error handling.
   *
   * @param projectId - Project identifier
   * @param channelName - Channel name
   * @param topic - Topic name
   * @param seq - Sequence number to persist
   * @returns Promise that resolves when persistence is complete
   */
  async persistSequence(
    projectId: string,
    channelName: string,
    topic: string,
    seq: string,
  ): Promise<void> {
    try {
      const key = STORAGE_KEYS.sequence(projectId, channelName, topic);
      await this.putStorageValue(key, seq);
      this.logVerbose(`[PERSIST_SEQ] Persisted sequence to storage: ${seq}`);
    } catch (error) {
      this.logError(`[PERSIST_SEQ] Failed to persist sequence: ${error}`);
      throw error;
    }
  }

  /**
   * Get the current sequence number for a topic without incrementing.
   *
   * @param projectId - Project identifier
   * @param channelName - Channel name
   * @param topic - Topic name
   * @returns Promise resolving to the current sequence number or '0' if none exists
   */
  async getCurrentSequence(
    projectId: string,
    channelName: string,
    topic: string,
  ): Promise<string> {
    const key = STORAGE_KEYS.sequence(projectId, channelName, topic);
    const sequence = (await this.getStorageValue<string>(key, "0")) || "0";

    this.logVerbose(
      `[GET_CURRENT_SEQ] Current sequence for topic ${topic}: ${sequence}`,
    );
    return sequence;
  }

  /**
   * Decode the timestamp from a ULID sequence.
   *
   * @param seq - ULID sequence to decode
   * @returns Timestamp in milliseconds
   * @throws Error if sequence is not a valid ULID
   */
  decodeSequenceTime(seq: string): number {
    try {
      return decodeTime(seq);
    } catch (error) {
      this.logError(`[DECODE_SEQ_TIME] Invalid ULID sequence: ${seq}`);
      throw new Error(`Invalid ULID sequence: ${seq}`);
    }
  }

  /**
   * Compare two ULID sequences for chronological ordering.
   *
   * @param seq1 - First sequence to compare
   * @param seq2 - Second sequence to compare
   * @returns -1 if seq1 < seq2, 0 if equal, 1 if seq1 > seq2
   */
  compareSequences(seq1: string, seq2: string): number {
    // ULIDs are lexicographically sortable
    if (seq1 < seq2) return -1;
    if (seq1 > seq2) return 1;
    return 0;
  }

  /**
   * Check if one sequence comes after another.
   *
   * @param seq - Sequence to check
   * @param afterSeq - Reference sequence
   * @returns True if seq comes after afterSeq
   */
  isSequenceAfter(seq: string, afterSeq: string): boolean {
    return this.compareSequences(seq, afterSeq) > 0;
  }

  /**
   * Override service name for consistent logging.
   */
  protected getServiceName(): string {
    return "[SEQUENCE_MANAGER]";
  }
}
