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
    switch (opts.client) {
      case ErebusClientState.PubSub: {
        const wsBaseUrl = opts.wsBaseUrl || "wss://gateway.erebus.sh";
        // Derive HTTP URL from WebSocket URL
        const httpBaseUrl = wsBaseUrl.replace(/^wss?:\/\//, (match) =>
          match === "wss://" ? "https://" : "http://",
        );

        const pubSubClient = new ErebusPubSubClient({
          wsUrl: `${wsBaseUrl}/v1/pubsub`,
          httpBaseUrl: httpBaseUrl,
          tokenProvider: async (channel: string): Promise<string> => {
            const authorize = new Authorize(opts.authBaseUrl);
            return await authorize.generateToken(channel);
          },
        });
        return pubSubClient;
      }
      default:
        throw new ErebusError("Invalid client state");
    }
  }
}
