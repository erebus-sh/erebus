import { BaseService } from "./BaseService";

/**
 * Manages shard coordination and location-aware routing for distributed channels.
 *
 * This service handles:
 * - Storing and retrieving available shards for cross-region broadcasting
 * - Location-aware filtering to avoid self-broadcasting
 * - Shard deduplication and consistency checks
 * - Optimization to skip unnecessary storage writes
 *
 * Shards represent different channel instances across regions/locations that need
 * to coordinate for global message broadcasting.
 */
export class ShardManager extends BaseService {
  /** Storage key for available shards list */
  private static readonly AVAILABLE_SHARDS_KEY = "avalibleShards"; // Keep original typo for compatibility

  /** Storage key for location hint */
  private static readonly LOCATION_HINT_KEY = "locationHint";

  /**
   * Get all available shards for cross-region message broadcasting.
   *
   * @returns Promise resolving to array of shard identifiers
   */
  async getAvailableShards(): Promise<string[]> {
    this.logDebug(`[GET_SHARDS] Getting available shards`);

    const shards =
      (await this.getStorageValue<string[]>(
        ShardManager.AVAILABLE_SHARDS_KEY,
        [],
      )) || [];

    this.logDebug(`[GET_SHARDS] Found ${shards.length} available shards`);
    return shards;
  }

  /**
   * Set available shards in local storage with location-aware filtering and deduplication.
   *
   * This method:
   * - Retrieves the current location hint to avoid self-referencing
   * - Deduplicates the shard list
   * - Filters out the current location from the shard list
   * - Optimizes by skipping writes if shards haven't changed
   * - Maintains consistency with concurrent updates
   *
   * @param shards - Array of shard identifiers to store
   * @returns Promise that resolves when shards are stored
   */
  async setShardsInLocalStorage(shards: string[]): Promise<void> {
    this.logDebug(
      `[SET_SHARDS] Setting shards in local storage - count: ${shards.length}`,
    );

    // Get current location to filter out self-references
    const myLocation = await this.getStorageValue<string>(
      ShardManager.LOCATION_HINT_KEY,
    );
    this.logDebug(`[SET_SHARDS] My location hint: ${myLocation}`);

    // Deduplicate and filter out self-location
    const uniqueShards = Array.from(new Set(shards)).filter(
      (shard) => shard !== myLocation,
    );

    this.logDebug(
      `[SET_SHARDS] Unique shards after filtering: ${uniqueShards.length}`,
    );

    // Check if update is needed (optimization to avoid unnecessary writes)
    const existingShards =
      (await this.getStorageValue<string[]>(
        ShardManager.AVAILABLE_SHARDS_KEY,
        [],
      )) || [];

    if (this.areShardsEqual(existingShards, uniqueShards)) {
      this.logDebug(`[SET_SHARDS] Shards already stored, skipping update`);
      return;
    }

    // Store the updated shard list
    await this.putStorageValue(ShardManager.AVAILABLE_SHARDS_KEY, uniqueShards);
    this.logDebug(
      `[SET_SHARDS] Shards stored successfully (count: ${uniqueShards.length})`,
    );
  }

  /**
   * Get the location hint for this channel instance.
   *
   * @returns Promise resolving to the location hint or null if not set
   */
  async getLocationHint(): Promise<string | null> {
    const location = await this.getStorageValue<string>(
      ShardManager.LOCATION_HINT_KEY,
    );
    this.logDebug(`[GET_LOCATION] Location hint: ${location}`);
    return location || null;
  }

  /**
   * Set the location hint for this channel instance.
   * This is typically called during WebSocket connection establishment.
   *
   * @param locationHint - The location identifier for this instance
   * @returns Promise that resolves when location is stored
   */
  async setLocationHint(locationHint: string): Promise<void> {
    this.logDebug(`[SET_LOCATION] Setting location hint: ${locationHint}`);

    await this.putStorageValue(ShardManager.LOCATION_HINT_KEY, locationHint);
    this.logDebug(`[SET_LOCATION] Location hint stored successfully`);
  }

  /**
   * Add a single shard to the available shards list.
   * Useful for dynamic shard discovery and registration.
   *
   * @param shardId - Shard identifier to add
   * @returns Promise that resolves when shard is added
   */
  async addShard(shardId: string): Promise<void> {
    this.logDebug(`[ADD_SHARD] Adding shard: ${shardId}`);

    const currentShards = await this.getAvailableShards();

    // Only add if not already present
    if (!currentShards.includes(shardId)) {
      const updatedShards = [...currentShards, shardId];
      await this.setShardsInLocalStorage(updatedShards);
      this.logDebug(`[ADD_SHARD] Shard added successfully`);
    } else {
      this.logDebug(`[ADD_SHARD] Shard already exists, skipping`);
    }
  }

  /**
   * Remove a shard from the available shards list.
   * Useful for shard deregistration and failure handling.
   *
   * @param shardId - Shard identifier to remove
   * @returns Promise that resolves when shard is removed
   */
  async removeShard(shardId: string): Promise<void> {
    this.logDebug(`[REMOVE_SHARD] Removing shard: ${shardId}`);

    const currentShards = await this.getAvailableShards();
    const filteredShards = currentShards.filter((shard) => shard !== shardId);

    if (filteredShards.length !== currentShards.length) {
      await this.setShardsInLocalStorage(filteredShards);
      this.logDebug(`[REMOVE_SHARD] Shard removed successfully`);
    } else {
      this.logDebug(`[REMOVE_SHARD] Shard not found, no action taken`);
    }
  }

  /**
   * Get shards filtered by location (excluding current location).
   * This is the primary method used for cross-region broadcasting.
   *
   * @returns Promise resolving to array of remote shard identifiers
   */
  async getRemoteShards(): Promise<string[]> {
    this.logDebug(`[GET_REMOTE_SHARDS] Getting remote shards`);

    const [allShards, myLocation] = await Promise.all([
      this.getAvailableShards(),
      this.getLocationHint(),
    ]);

    const remoteShards = allShards.filter((shard) => shard !== myLocation);
    this.logDebug(
      `[GET_REMOTE_SHARDS] Found ${remoteShards.length} remote shards ` +
        `(total: ${allShards.length}, my location: ${myLocation})`,
    );

    return remoteShards;
  }

  /**
   * Check if this instance should broadcast to other shards.
   *
   * @returns Promise resolving to true if there are remote shards to broadcast to
   */
  async shouldBroadcastToShards(): Promise<boolean> {
    const remoteShards = await this.getRemoteShards();
    const shouldBroadcast = remoteShards.length > 0;

    this.logDebug(
      `[SHOULD_BROADCAST] Should broadcast to shards: ${shouldBroadcast}`,
    );
    return shouldBroadcast;
  }

  /**
   * Get comprehensive shard information for diagnostics.
   *
   * @returns Promise resolving to shard status information
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

    const status = {
      myLocation,
      allShards,
      remoteShards,
      totalShards: allShards.length,
      shouldBroadcast: remoteShards.length > 0,
    };

    this.logDebug(`[SHARD_STATUS] ${JSON.stringify(status)}`);
    return status;
  }

  /**
   * Clear all shard information (useful for testing and reset scenarios).
   *
   * @returns Promise that resolves when all shard data is cleared
   */
  async clearShards(): Promise<void> {
    this.logDebug(`[CLEAR_SHARDS] Clearing all shard information`);

    await Promise.all([
      this.deleteStorageValue(ShardManager.AVAILABLE_SHARDS_KEY),
      this.deleteStorageValue(ShardManager.LOCATION_HINT_KEY),
    ]);

    this.logDebug(`[CLEAR_SHARDS] All shard information cleared`);
  }

  /**
   * Compare two shard arrays for equality (order-independent).
   *
   * @param shards1 - First shard array
   * @param shards2 - Second shard array
   * @returns True if arrays contain the same shards
   */
  private areShardsEqual(shards1: string[], shards2: string[]): boolean {
    if (shards1.length !== shards2.length) {
      return false;
    }

    const set1 = new Set(shards1);
    const set2 = new Set(shards2);

    if (set1.size !== set2.size) {
      return false;
    }

    for (const shard of set1) {
      if (!set2.has(shard)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Override service name for consistent logging.
   */
  protected getServiceName(): string {
    return "[SHARD_MANAGER]";
  }
}
