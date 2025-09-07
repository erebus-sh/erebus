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
}

export class ErebusClient {
  static async createClient(
    opts: ErebusClientOptions,
  ): Promise<ErebusPubSubClient> {
    switch (opts.client) {
      case ErebusClientState.PubSub:
        const pubSubClient = new ErebusPubSubClient({
          wsUrl: opts.wsBaseUrl
            ? `${opts.wsBaseUrl}/v1/pubsub`
            : "wss://gateway.erebus.sh/v1/pubsub",
          tokenProvider: async (channel: string) => {
            const authorize = new Authorize(opts.authBaseUrl);
            return await authorize.generateToken(channel);
          },
        });

        return pubSubClient;
      default:
        throw new ErebusError("Invalid client state");
    }
  }

  static createClientSync(opts: ErebusClientOptions): ErebusPubSubClient {
    switch (opts.client) {
      case ErebusClientState.PubSub:
        const pubSubClient = new ErebusPubSubClient({
          wsUrl: opts.wsBaseUrl
            ? `${opts.wsBaseUrl}/v1/pubsub`
            : "wss://gateway.erebus.sh/v1/pubsub",
          tokenProvider: (channel: string) => {
            const authorize = new Authorize(opts.authBaseUrl);

            // If the user provided a grant cache layer, we call it.
            if (opts.grantCacheLayer) {
              console.log("[ErebusClient] Using grant cache layer");
              const grantPromise = opts.grantCacheLayer();
              // grantCacheLayer returns a Promise<string | undefined>
              return grantPromise.then((grant) => {
                if (grant) {
                  console.log("[ErebusClient] Grant found, returning grant");
                  return grant;
                }
                // If no grant, just call the default token provider
                console.log(
                  "[ErebusClient] No grant, calling default token provider",
                );
                return authorize.generateToken(channel);
              });
            }

            // This will return a Promise<string>
            const token = authorize.generateToken(channel).then((token) => {
              if (opts.cacheGrant) {
                console.log("[ErebusClient] Caching grant");
                opts.cacheGrant(token);
              }
              return token;
            });
            console.log("[ErebusClient] Returning token");
            return token;
          },
        });

        return pubSubClient;
      default:
        throw new ErebusError("Invalid client state");
    }
  }
}
