import { getChannelsForProjectId } from "@/services/channelShards";
import { Env } from "@/env";

/***
 * The following logic is primarily utilized to administratively pause or unpause all channels
 * associated with a given project. This mechanism is most often invoked when a project has
 * exceeded its usage limits or has overdue payments, ensuring compliance with service policies.
 *
 * The core logic retrieves all channel identifiers registered under the specified project ID,
 * then iterates over each channel, invoking the appropriate pause or resume operation on the
 * corresponding Durable Object stub. This ensures that all active channels for the project
 * are consistently transitioned to the desired state (paused or unpaused) in a scalable and
 * reliable manner.
 */

interface ProjectIdCommandProps {
  projectId: string;
  env: Env;
}

/***
 * Helper function to fetch all channels associated with a project.
 */
async function getChannels(env: Env, projectId: string) {
  return await getChannelsForProjectId(env, projectId);
}

/***
 * Pauses all channels for a given project. Typically used when a project is over its usage
 * limits or has overdue payments. This ensures that no further activity can occur on any
 * channel until the project is re-enabled.
 */
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

/***
 * Unpauses all channels for a given project. This is generally called after a project
 * has resolved its payment or usage issues, restoring normal operation to all channels.
 */
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
