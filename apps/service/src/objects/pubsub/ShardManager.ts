import type { ServiceContext } from "./types";
import {
  type Logger,
  createLogger,
  getStorageValue,
  putStorageValue,
  deleteStorageValue,
} from "./service-utils";

/**
 * Manages shard coordination and location-aware routing for distributed channels.
 *
 * Key design decisions for Durable Objects single-threaded actor model:
 * - In-memory cache for location hint and shards (change infrequently)
 * - Invalidation on explicit set operations
 * - Null-safe location filtering
 */
export class ShardManager {
  private readonly ctx: DurableObjectState;
  private readonly log: Logger;

  /** Storage key for available shards list (preserving original typo for compatibility) */
  private static readonly AVAILABLE_SHARDS_KEY = "avalibleShards";
  private static readonly LOCATION_HINT_KEY = "locationHint";

  /** In-memory caches */
  private cachedShards: string[] | null = null;
  private cachedLocation: string | null | undefined = undefined; // undefined = not loaded

  constructor(serviceContext: ServiceContext) {
    this.ctx = serviceContext.ctx;
    this.log = createLogger("[SHARD_MANAGER]", serviceContext.env);
  }

  /**
   * Get all available shards for cross-region message broadcasting.
   */
  async getAvailableShards(): Promise<string[]> {
    if (this.cachedShards !== null) return this.cachedShards;

    const shards =
      (await getStorageValue<string[]>(
        this.ctx,
        ShardManager.AVAILABLE_SHARDS_KEY,
        [],
      )) || [];

    this.cachedShards = shards;
    this.log.debug(`[GET_SHARDS] Found ${shards.length} available shards`);
    return shards;
  }

  /**
   * Set available shards with location-aware filtering and deduplication.
   */
  async setShardsInLocalStorage(shards: string[]): Promise<void> {
    this.log.debug(`[SET_SHARDS] Setting shards, count: ${shards.length}`);

    const myLocation = await this.getLocationHint();

    // Deduplicate and filter out self-location (null-safe)
    const uniqueShards = Array.from(new Set(shards)).filter(
      (shard) => !myLocation || shard !== myLocation,
    );

    // Check if update is needed
    const existingShards = await this.getAvailableShards();
    if (this.areShardsEqual(existingShards, uniqueShards)) {
      this.log.debug(`[SET_SHARDS] Shards unchanged, skipping write`);
      return;
    }

    await putStorageValue(
      this.ctx,
      ShardManager.AVAILABLE_SHARDS_KEY,
      uniqueShards,
    );
    this.cachedShards = uniqueShards;
    this.log.debug(`[SET_SHARDS] Stored ${uniqueShards.length} shards`);
  }

  /**
   * Get the location hint for this channel instance.
   */
  async getLocationHint(): Promise<string | null> {
    if (this.cachedLocation !== undefined) return this.cachedLocation;

    const location = await getStorageValue<string>(
      this.ctx,
      ShardManager.LOCATION_HINT_KEY,
    );
    this.cachedLocation = location || null;
    return this.cachedLocation;
  }

  /**
   * Set the location hint for this channel instance.
   */
  async setLocationHint(locationHint: string): Promise<void> {
    this.log.debug(`[SET_LOCATION] Setting location hint: ${locationHint}`);
    await putStorageValue(
      this.ctx,
      ShardManager.LOCATION_HINT_KEY,
      locationHint,
    );
    this.cachedLocation = locationHint;
  }

  /**
   * Add a single shard to the available shards list.
   */
  async addShard(shardId: string): Promise<void> {
    const currentShards = await this.getAvailableShards();
    if (!currentShards.includes(shardId)) {
      await this.setShardsInLocalStorage([...currentShards, shardId]);
    }
  }

  /**
   * Remove a shard from the available shards list.
   */
  async removeShard(shardId: string): Promise<void> {
    const currentShards = await this.getAvailableShards();
    const filtered = currentShards.filter((s) => s !== shardId);
    if (filtered.length !== currentShards.length) {
      await this.setShardsInLocalStorage(filtered);
    }
  }

  /**
   * Get shards filtered by location (excluding current location).
   */
  async getRemoteShards(): Promise<string[]> {
    const [allShards, myLocation] = await Promise.all([
      this.getAvailableShards(),
      this.getLocationHint(),
    ]);
    return myLocation
      ? allShards.filter((shard) => shard !== myLocation)
      : allShards;
  }

  /**
   * Check if this instance should broadcast to other shards.
   */
  async shouldBroadcastToShards(): Promise<boolean> {
    return (await this.getRemoteShards()).length > 0;
  }

  /**
   * Get comprehensive shard information for diagnostics.
   */
  async getShardStatus(): Promise<{
    myLocation: string | null;
    allShards: string[];
    remoteShards: string[];
    totalShards: number;
    shouldBroadcast: boolean;
  }> {
    const [myLocation, allShards, remoteShards] = await Promise.all([
      this.getLocationHint(),
      this.getAvailableShards(),
      this.getRemoteShards(),
    ]);
    return {
      myLocation,
      allShards,
      remoteShards,
      totalShards: allShards.length,
      shouldBroadcast: remoteShards.length > 0,
    };
  }

  /**
   * Clear all shard information.
   */
  async clearShards(): Promise<void> {
    await Promise.all([
      deleteStorageValue(this.ctx, ShardManager.AVAILABLE_SHARDS_KEY),
      deleteStorageValue(this.ctx, ShardManager.LOCATION_HINT_KEY),
    ]);
    this.cachedShards = null;
    this.cachedLocation = undefined;
  }

  private areShardsEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    const setA = new Set(a);
    return b.every((s) => setA.has(s));
  }
}
