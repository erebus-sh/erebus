import { ErebusError } from "@/internal/error";

import { Authorize } from "./authorize";
import { ErebusPubSubClient } from "./pubsub/ErebusPubSubClient";

export enum ErebusClientState {
  PubSub,
}

export interface ErebusClientOptions {
  client: ErebusClientState;
  grantCacheLayer?: () => Promise<string | undefined>;
  cacheGrant?: (grant: string) => void;
  authBaseUrl: string;
  wsBaseUrl?: string;
  enableCaching?: boolean; // Optional, defaults to true
}

export class ErebusClient {
  static createClient(opts: ErebusClientOptions): ErebusPubSubClient {
    console.log(
      "[ErebusSDK] [ErebusClient.createClient] called with options",
      opts,
    );

    switch (opts.client) {
      case ErebusClientState.PubSub: {
        const wsBaseUrl = opts.wsBaseUrl || "wss://gateway.erebus.sh";
        console.log(
          "[ErebusSDK] [ErebusClient.createClient] using wsBaseUrl:",
          wsBaseUrl,
        );

        // Derive HTTP URL from WebSocket URL
        const httpBaseUrl = wsBaseUrl.replace(/^wss?:\/\//, (match) =>
          match === "wss://" ? "https://" : "http://",
        );
        console.log(
          "[ErebusSDK] [ErebusClient.createClient] derived httpBaseUrl:",
          httpBaseUrl,
        );

        const pubSubClient = new ErebusPubSubClient({
          wsUrl: `${wsBaseUrl}/v1/pubsub`,
          httpBaseUrl: httpBaseUrl,
          tokenProvider: async (channel: string): Promise<string> => {
            if (opts.grantCacheLayer) {
              console.log(
                "[ErebusSDK] [tokenProvider] Checking grantCacheLayer for channel:",
                channel,
              );
              const grant = await opts.grantCacheLayer();
              if (grant) {
                console.log(
                  "[ErebusSDK] [tokenProvider] Found cached grant for channel:",
                  channel,
                );
                return grant;
              }
              console.log(
                "[ErebusSDK] [tokenProvider] No cached grant found for channel:",
                channel,
              );
            }
            console.log(
              "[ErebusSDK] [tokenProvider] Requesting new grant for channel:",
              channel,
            );
            const authorize = new Authorize(opts.authBaseUrl);
            const grant = await authorize.generateToken(channel);
            if (opts.cacheGrant) {
              console.log(
                "[ErebusSDK] [tokenProvider] Caching new grant for channel:",
                channel,
              );
              opts.cacheGrant(grant);
            }
            return grant;
          },
        });
        console.log(
          "[ErebusSDK] [ErebusClient.createClient] ErebusPubSubClient created",
        );
        return pubSubClient;
      }
      default:
        console.error(
          "[ErebusSDK] [ErebusClient.createClient] Invalid client state:",
          opts.client,
        );
        throw new ErebusError("Invalid client state");
    }
  }
}
