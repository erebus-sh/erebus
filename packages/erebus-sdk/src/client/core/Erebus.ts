import { Authorize } from "./authorize";
import { ErebusPubSubClientNew as ErebusPubSubClient } from "./pubsub/ErebusPubSubClientNew";
export enum ErebusClientState {
  PubSub,
}

export interface ErebusClientOptions {
  client: ErebusClientState;
  authBaseUrl: string;
  wsBaseUrl?: string;
  channel: string; // Required channel for PubSub operations
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
          channel: opts.channel,
        });

        return pubSubClient;
      default:
        throw new Error("Invalid client state");
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
            // This will return a Promise, but the function itself is sync.
            // The consumer must handle the async tokenProvider as usual.
            return authorize.generateToken(channel);
          },
          channel: opts.channel,
        });

        return pubSubClient;
      default:
        throw new Error("Invalid client state");
    }
  }
}
