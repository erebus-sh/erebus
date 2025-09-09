import type { ErebusPubSubClient } from "@/client/core/pubsub";

function noop(): void {}

export function createNoopPubSubClient(): ErebusPubSubClient {
  const now = Date.now();
  const noopClient = {
    // lifecycle
    connect: (_timeout?: number) => undefined as unknown as Promise<void>,
    joinChannel: (_channel: string) => undefined,
    close: () => undefined,

    // subscriptions
    subscribe: (
      _topic: string,
      _handler: unknown,
      _onAck?: unknown,
      _timeoutMs?: number,
    ) => undefined,
    subscribeWithCallback: (
      _topic: string,
      _handler: unknown,
      _onAck?: unknown,
      _timeoutMs?: number,
    ) => undefined,
    unsubscribe: (_topic: string) => undefined,
    unsubscribeWithCallback: (
      _topic: string,
      _onAck?: unknown,
      _timeoutMs?: number,
    ) => undefined,

    // publish
    publish: (_args: { topic: string; messageBody: string }) =>
      Promise.resolve("noop"),
    publishWithAck: (_args: {
      topic: string;
      messageBody: string;
      onAck: unknown;
      timeoutMs?: number;
    }) => Promise.resolve("noop"),

    // presence
    onPresence: (_topic: string, _handler: unknown) => undefined,
    offPresence: (_topic: string, _handler: unknown) => undefined,
    clearPresenceHandlers: (_topic: string) => undefined,

    // waits
    waitForSubscriptionReadiness: (_timeoutMs?: number) => Promise.resolve(),

    // getters (as properties)
    get __debugSummary() {
      return { handlerCount: 0, topics: [], counts: {} };
    },
    get __debugConn() {
      return {} as unknown as object;
    },
    get __debugObject() {
      return {
        conn: {} as unknown as object,
        handlers: new Map(),
        connectionObject: {
          url: "",
          state: "closed",
          subs: [],
          bufferedAmount: 0,
        },
        handlerCount: 0,
        topics: [],
        counts: {},
        processedMessagesCount: 0,
      } as unknown as Record<string, unknown>;
    },
    get connectionState() {
      return "closed";
    },
    get isConnected() {
      return false;
    },
    get channel() {
      return null;
    },
    get subscriptionCount() {
      return 0;
    },
    get activeTopics() {
      return [] as string[];
    },
    get pendingSubscriptionsCount() {
      return 0;
    },
    get processedMessagesCount() {
      return 0;
    },
    get connectionHealth() {
      return {
        state: "closed",
        isConnected: false,
        isReadable: false,
        isWritable: false,
        channel: null,
        subscriptionCount: 0,
        pendingSubscriptionsCount: 0,
        processedMessagesCount: 0,
        connectionDetails: {
          state: "closed",
          isConnected: false,
          isReadable: false,
          isWritable: false,
          channel: "",
          subscriptionCount: 0,
          readyState: undefined,
          bufferedAmount: 0,
          connectionId: "noop",
          url: "",
        },
      };
    },
    get isReadable() {
      return false;
    },
    get isWritable() {
      return false;
    },
  } as unknown as ErebusPubSubClient;

  // keep tree-shaking happy for otherwise-unused helpers
  void noop;
  void now;

  return noopClient;
}
