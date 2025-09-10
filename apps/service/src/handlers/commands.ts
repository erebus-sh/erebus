import { getChannelsForProjectId } from "@/services/channelShards";
import { Env } from "@/env";

interface ProjectIdCommandProps {
  projectId: string;
  env: Env;
}

async function getChannels(env: Env, projectId: string) {
  return await getChannelsForProjectId(env, projectId);
}

export async function pauseProjectId({
  projectId,
  env,
}: ProjectIdCommandProps) {
  const availableChannels = await getChannels(env, projectId);

  await Promise.all(
    availableChannels.map((channel) => {
      const stub = env.CHANNEL.getByName(channel);
      return stub.pause();
    }),
  );
}

export async function unpauseProjectId({
  projectId,
  env,
}: ProjectIdCommandProps) {
  const availableChannels = await getChannels(env, projectId);

  await Promise.all(
    availableChannels.map((channel) => {
      const stub = env.CHANNEL.getByName(channel);
      return stub.resume();
    }),
  );
}
