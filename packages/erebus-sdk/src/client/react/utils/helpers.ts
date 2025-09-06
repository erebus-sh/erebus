import type { ErebusPubSubClient } from "@/client/core/pubsub";
import { ErebusError } from "@/service";
import { withTimeout } from "./withTimeout";

export async function joinAndConnect(
  client: ErebusPubSubClient,
  channel: string,
  timeout: number = 10000,
): Promise<{ success: boolean; error: ErebusError | null }> {
  try {
    client.joinChannel(channel);
    withTimeout(client.connect(), timeout, "joinAndConnect");
    return { success: true, error: null };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof ErebusError
          ? error
          : new ErebusError("Failed to join and connect"),
    };
  }
}
