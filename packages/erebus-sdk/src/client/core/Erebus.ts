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
        const enableCaching = opts.enableCaching !== false; // Default to true
        const pubSubClient = new ErebusPubSubClient({
          wsUrl: opts.wsBaseUrl
            ? `${opts.wsBaseUrl}/v1/pubsub`
            : "wss://gateway.erebus.sh/v1/pubsub",
          tokenProvider: (channel: string) => {
            const authorize = new Authorize(opts.authBaseUrl);
            console.log("[ErebusClient] Authorize created");

            // If caching is disabled, always get a fresh token
            if (!enableCaching) {
              console.log(
                "[ErebusClient] Caching disabled, getting fresh token",
              );
              return authorize.generateToken(channel);
            }

            // If the user provided a grant cache layer, we call it first
            if (opts.grantCacheLayer) {
              console.log("[ErebusClient] Using grant cache layer");
              const grantPromise = opts.grantCacheLayer();
              // grantCacheLayer returns a Promise<string | undefined>
              return grantPromise.then((grant) => {
                if (grant) {
                  console.log("[ErebusClient] Cached grant found, using it");
                  return grant;
                }
                // If no cached grant, get fresh token and cache it
                console.log(
                  "[ErebusClient] No cached grant, getting fresh token",
                );
                return authorize.generateToken(channel).then((token) => {
                  if (opts.cacheGrant) {
                    console.log("[ErebusClient] Caching fresh grant");
                    opts.cacheGrant(token);
                  }
                  return token;
                });
              });
            }

            // No external cache layer, just get fresh token and optionally cache it
            console.log("[ErebusClient] No cache layer, getting fresh token");
            const token = authorize.generateToken(channel).then((token) => {
              if (opts.cacheGrant) {
                console.log("[ErebusClient] Caching grant");
                opts.cacheGrant(token);
              }
              return token;
            });
            return token;
          },
        });

        return pubSubClient;
      default:
        throw new ErebusError("Invalid client state");
    }
  }
}
