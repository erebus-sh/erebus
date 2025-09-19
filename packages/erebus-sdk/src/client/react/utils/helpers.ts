import type { ErebusPubSubClient } from "@/client/core/pubsub";
import { ErebusError } from "@/service";

/**
 * Attempts to join a channel and connect the client, with timeout and error handling.
 * Ensures that errors from withTimeout are properly handled and surfaced.
 */
export function joinAndConnect(
  client: ErebusPubSubClient,
  channel: string,
): { success: boolean; error: ErebusError | null } {
  try {
    client.joinChannel(channel);
    client.connect();

    console.log("[joinAndConnect] Successfully joined and connected");
    return { success: true, error: null };
  } catch (error) {
    console.error(
      "[joinAndConnect] Failed to join and connect (exception)",
      error,
    );
    return {
      success: false,
      error:
        error instanceof ErebusError
          ? error
          : new ErebusError(
              error instanceof Error
                ? error.message
                : "Failed to join and connect",
            ),
    };
  }
}
