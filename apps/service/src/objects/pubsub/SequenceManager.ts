import { monotonicFactory, decodeTime, type ULIDFactory } from "ulid";
import { hashStringToSeed } from "@/lib/hash";
import { seededRandom } from "@/lib/seed";
import { monoNow } from "@/lib/monotonic";
import { STORAGE_KEYS, type ServiceContext } from "./types";
import {
  type Logger,
  createLogger,
  getStorageValue,
  putStorageValue,
} from "./service-utils";

/**
 * Manages ULID sequence generation and persistence for topics.
 *
 * Key design decisions for Durable Objects single-threaded actor model:
 * - In-memory sequence cache eliminates storage read on every publish
 * - Lazy hydration from storage on first access after hibernation wake
 * - ULIDs provide monotonic, lexicographically sortable IDs
 * - Per-topic seeded randomness for deterministic generation
 */
export class SequenceManager {
  private readonly ctx: DurableObjectState;
  private readonly log: Logger;

  /** In-memory cache: storage key → last sequence ULID */
  private seqCache = new Map<string, string>();

  constructor(serviceContext: ServiceContext) {
    this.ctx = serviceContext.ctx;
    this.log = createLogger("[SEQUENCE_MANAGER]", serviceContext.env);
  }

  /**
   * Generate a new monotonic sequence number for a topic.
   * Reads from cache first, falls back to storage on miss.
   */
  async generateSequence(
    projectId: string,
    channelName: string,
    topic: string,
  ): Promise<string> {
    const startTime = monoNow();

    const storageKey = STORAGE_KEYS.sequence(projectId, channelName, topic);

    // Check cache first, hydrate from storage on miss
    let lastSeq = this.seqCache.get(storageKey);
    if (lastSeq === undefined) {
      lastSeq = (await getStorageValue<string>(this.ctx, storageKey)) ?? "0";
    }

    // Create topic-specific ULID factory with seeded randomness
    const seed = hashStringToSeed(topic);
    const ulidFactory = monotonicFactory(seededRandom(seed)) as ULIDFactory;

    let newSeq: string;

    if (!lastSeq || lastSeq === "0") {
      newSeq = ulidFactory();
      this.log.debug(`[GENERATE_SEQ] First sequence: ${newSeq}`);
    } else {
      const lastTime = decodeTime(lastSeq);
      const nextTime = Math.max(lastTime, Date.now());
      newSeq = ulidFactory(nextTime);
      this.log.debug(`[GENERATE_SEQ] Monotonic sequence: ${newSeq}`);
    }

    // Update cache immediately
    this.seqCache.set(storageKey, newSeq);

    // Persist to storage
    await putStorageValue(this.ctx, storageKey, newSeq);

    const duration = monoNow() - startTime;
    this.log.debug(`[GENERATE_SEQ] Completed in ${duration.toFixed(2)}ms`);

    return newSeq;
  }

  /**
   * Get the current sequence number for a topic without incrementing.
   */
  async getCurrentSequence(
    projectId: string,
    channelName: string,
    topic: string,
  ): Promise<string> {
    const key = STORAGE_KEYS.sequence(projectId, channelName, topic);

    // Check cache first
    const cached = this.seqCache.get(key);
    if (cached) return cached;

    const seq = (await getStorageValue<string>(this.ctx, key, "0")) || "0";
    this.seqCache.set(key, seq);
    return seq;
  }

  /**
   * Decode the timestamp from a ULID sequence.
   */
  decodeSequenceTime(seq: string): number {
    return decodeTime(seq);
  }

  /**
   * Compare two ULID sequences for chronological ordering.
   */
  compareSequences(seq1: string, seq2: string): number {
    if (seq1 < seq2) return -1;
    if (seq1 > seq2) return 1;
    return 0;
  }

  /**
   * Check if one sequence comes after another.
   */
  isSequenceAfter(seq: string, afterSeq: string): boolean {
    return this.compareSequences(seq, afterSeq) > 0;
  }
}
