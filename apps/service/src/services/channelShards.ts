import { Env } from "@/env";
import { DistributedKey } from "@/lib/distributedKey";

// NOTE: This module uses Cloudflare KV (key-value) storage via `env.CACHE`.
// Writes can be slow to propagate (eventual consistency). We'll revisit and
// optimize this behavior later if needed.

export const shardsKey = (channelDistributedId: string) =>
  `shards:${channelDistributedId}`;

export const projectIdKey = (projectId: string) => `projectId:${projectId}`;

/**
 * Registers a channelDistributedId under a given projectId and registers a locationHint (shard)
 * for the same channelDistributedId in KV storage.
 *
 * @param env - The environment object
 * @param projectId - The projectId to register the channelDistributedId under
 * @param channelDistributedId - The channelDistributedId to register
 * @param locationHint - The locationHint to register for the channelDistributedId
 * @returns A boolean indicating if the operations were successful
 */
export async function registerChannelAndShard(
  env: Env,
  projectId: string,
  channelDistributedId: string,
  locationHint: string,
) {
  const channelDistributedIdWithLocationHint =
    DistributedKey.appendLocationHint(channelDistributedId, locationHint);

  const cache = env.CACHE;

  // Get current data
  const [projectChannelsData, shardsData] = await Promise.all([
    cache.get(projectIdKey(projectId), "json") as Promise<string[] | null>,
    cache.get(shardsKey(channelDistributedId), "json") as Promise<
      string[] | null
    >,
  ]);

  const projectChannels = projectChannelsData || [];
  const shards = shardsData || [];

  let projectNeedsUpdate = false;
  let shardsNeedsUpdate = false;

  // Check if channelDistributedId is already in the project
  if (!projectChannels.includes(channelDistributedId)) {
    projectChannels.push(channelDistributedId);
    projectNeedsUpdate = true;
  }

  // Check if shard is already registered for the channel
  if (!shards.includes(channelDistributedIdWithLocationHint)) {
    shards.push(channelDistributedIdWithLocationHint);
    shardsNeedsUpdate = true;
  }

  // Update KV storage
  const promises: Promise<void>[] = [];

  if (projectNeedsUpdate) {
    promises.push(
      cache.put(projectIdKey(projectId), JSON.stringify(projectChannels)),
    );
  }

  if (shardsNeedsUpdate) {
    promises.push(
      cache.put(shardsKey(channelDistributedId), JSON.stringify(shards)),
    );
  }

  if (promises.length > 0) {
    await Promise.all(promises);
  }

  return true;
}

/**
 * Retrieves all channelDistributedIds registered under a given projectId.
 * This function fetches the JSON array from KV storage keyed by the project.
 * Returns an array of channelDistributedIds for the project.
 *
 * @param env - The environment object
 * @param projectId - The projectId to get the channelDistributedIds for
 * @returns An array of channelDistributedIds for the project
 */
export async function getChannelsForProjectId(env: Env, projectId: string) {
  const cache = env.CACHE;
  const channels = (await cache.get(projectIdKey(projectId), "json")) as
    | string[]
    | null;
  return channels || [];
}

/**
 * Retrieves all location hints (shards) registered for a specific channelDistributedId.
 * This function fetches the JSON array from KV storage keyed by the channel's shard key.
 * Returns an array of location hints for the channel.
 *
 * @param env - The environment object
 * @param channelDistributedId - The channelDistributedId to get the location hints for
 * @returns An array of location hints for the channel
 */
export async function getShards(env: Env, channelDistributedId: string) {
  const cache = env.CACHE;
  const shards = (await cache.get(shardsKey(channelDistributedId), "json")) as
    | string[]
    | null;
  return shards || [];
}
