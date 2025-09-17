import { ErebusError } from "@/internal/error";

import { Authorize } from "./authorize";
import { ErebusPubSubClientNew as ErebusPubSubClient } from "./pubsub/ErebusPubSubClient";

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
        const pubSubClient = new ErebusPubSubClient({
          wsUrl: opts.wsBaseUrl
            ? `${opts.wsBaseUrl}/v1/pubsub`
            : "wss://gateway.erebus.sh/v1/pubsub",
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
