import { HandlerProps } from "@/types/handlerProps";
import { getShards } from "@/services/channelShards";
import { DistributedKey } from "@/lib/distributedKey";
import { Env } from "@/env";

interface ProjectIdCommandProps {
  projectId: string;
  channel: string;
  env: Env;
}

async function getShardsForProjectId(
  env: Env,
  projectId: string,
  channel: string,
) {
  const distributedId = DistributedKey.stringify({
    projectId,
    resource: channel,
    resourceType: "channel",
    version: "v1",
  });
  return await getShards(env, distributedId);
}

export async function pauseProjectId({
  projectId,
  channel,
  env,
}: ProjectIdCommandProps) {
  const availableShards = await getShardsForProjectId(env, projectId, channel);

  await Promise.all(
    availableShards.map((shard) => {
      const shardManager = env.CHANNEL.getByName(shard);
      return shardManager.pause();
    }),
  );
}

export async function unpauseProjectId({
  projectId,
  channel,
  env,
}: ProjectIdCommandProps) {
  const availableShards = await getShardsForProjectId(env, projectId, channel);

  await Promise.all(
    availableShards.map((shard) => {
      const shardManager = env.CHANNEL.getByName(shard);
      return shardManager.resume();
    }),
  );
}
