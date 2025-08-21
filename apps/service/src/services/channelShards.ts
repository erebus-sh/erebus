import { getRedis } from "@/utils/redis";
import { Env } from "@/env";
import { DistributedKey } from "@/lib/distributedKey";

export const shardsKey = (channelDistributedId: string) =>
  `shards:${channelDistributedId}`;

/**
 * Registers a channelDistributedId under a given projectId and registers a locationHint (shard)
 * for the same channelDistributedId in a single Redis transaction.
 * This ensures both operations are atomic.
 *
 * @param env - The environment object
 * @param projectId - The projectId to register the channelDistributedId under
 * @param channelDistributedId - The channelDistributedId to register
 * @param locationHint - The locationHint to register for the channelDistributedId
 * @returns An object indicating if each operation added a new member
 */
export async function registerChannelAndShard(
  env: Env,
  projectId: string,
  channelDistributedId: string,
  locationHint: string,
) {
  const redis = await getRedis(env);

  const channelDistributedIdWithLocationHint =
    DistributedKey.appendLocationHint(channelDistributedId, locationHint);

  // Check if both are already present
  const [isChannelInProject, isShardInChannel] = await Promise.all([
    redis.sismember(projectId, channelDistributedId),
    redis.sismember(
      shardsKey(channelDistributedId),
      channelDistributedIdWithLocationHint,
    ),
  ]);

  if (isChannelInProject && isShardInChannel) {
    return true;
  }

  const multi = redis.multi();
  if (!isChannelInProject) {
    multi.sadd(projectId, channelDistributedId);
  }
  if (!isShardInChannel) {
    multi.sadd(
      shardsKey(channelDistributedId),
      channelDistributedIdWithLocationHint,
    );
  }

  const results = await multi.exec();

  // If both were added (or already present), return true
  if (
    (isChannelInProject || (results && results[0] === 1)) &&
    (isShardInChannel ||
      (results && (results.length === 2 ? results[1] : results[0]) === 1))
  ) {
    return true;
  }

  return false;
}

/**
 * Retrieves all channelDistributedIds registered under a given projectId.
 * This function fetches all members of the Redis set keyed by projectId.
 * Returns an array of channelDistributedIds for the project.
 *
 * @param env - The environment object
 * @param projectId - The projectId to get the channelDistributedIds for
 * @returns An array of channelDistributedIds for the project
 */
export async function getChannelsForProjectId(env: Env, projectId: string) {
  const redis = await getRedis(env);
  const channels = await redis.smembers(projectId);
  return channels;
}

/**
 * Retrieves all location hints (shards) registered for a specific channelDistributedId.
 * This function fetches all members of the Redis set keyed by the channel's shard key.
 * Returns an array of location hints for the channel.
 *
 * @param env - The environment object
 * @param channelDistributedId - The channelDistributedId to get the location hints for
 * @returns An array of location hints for the channel
 */
export async function getShards(env: Env, channelDistributedId: string) {
  const redis = await getRedis(env);
  const shards = await redis.smembers(shardsKey(channelDistributedId));
  return shards;
}
