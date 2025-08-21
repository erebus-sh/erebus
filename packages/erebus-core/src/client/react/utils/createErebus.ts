import type { MessageBody } from "@/internal/schemas/messageBody";
import { useCallback, useEffect } from "react";
import { useErebusStore } from "@/client/react/store/erebus";
import { useChannelState } from "@/client/react/store/channelState";
import { z } from "zod";
import { ErebusClient, ErebusClientState } from "@/client/core/Erebus";

type AnySchema = z.ZodTypeAny;

export type ChannelName<S extends Record<string, AnySchema>> = keyof S & string;

interface CreateErebusOptions {
  wsUrl?: string;
  authUrl?: string;
  debug?: boolean; // Enable verbose logging for debugging
}

export function createErebus<S extends Record<string, AnySchema>>(
  schemas: S,
  options?: CreateErebusOptions,
) {
  console.log(
    "[createErebus] Function called with schemas:",
    Object.keys(schemas),
  );

  /* ─────────────── generic helpers ─────────────── */
  type Channel = ChannelName<S>;
  type Payload<C extends Channel> = z.infer<S[C]>;
  type MetaWithPayload<C extends Channel> = MessageBody & {
    payload: Payload<C>;
  };
  type ChannelMessages = { [K in Channel]: MetaWithPayload<K>[] };

  function parse<C extends Channel>(channel: C, input: unknown): Payload<C> {
    console.log(`[parse] Parsing channel "${channel}" with input:`, input);
    const schema = schemas[channel] as AnySchema;
    try {
      const result = schema.parse(input) as Payload<C>;
      console.log(`[parse] Successfully parsed channel "${channel}":`, result);
      return result;
    } catch (error) {
      console.error(`[parse] Failed to parse channel "${channel}":`, error);
      throw error;
    }
  }

  function validateMessage<C extends Channel>(
    channel: C,
    body: MessageBody & { payload: unknown },
  ): MetaWithPayload<C> {
    console.log(
      `[validateMessage] Validating message for channel "${channel}":`,
      body,
    );

    // If payload is a string, try to parse it as JSON first
    let payloadToValidate = body.payload;
    if (typeof body.payload === "string") {
      try {
        payloadToValidate = JSON.parse(body.payload);
        console.log(
          `[validateMessage] Successfully parsed JSON payload for channel "${channel}":`,
          payloadToValidate,
        );
      } catch (error) {
        // If JSON parsing fails, use the string as-is
        console.log(
          `[validateMessage] JSON parsing failed for channel "${channel}", using string as-is:`,
          body.payload,
        );
        payloadToValidate = body.payload;
      }
    }

    try {
      const payload = parse(channel, payloadToValidate);
      const result = { ...body, payload } as MetaWithPayload<C>;
      console.log(
        `[validateMessage] Successfully validated message for channel "${channel}":`,
        result,
      );
      return result;
    } catch (error) {
      console.error(
        `[validateMessage] Failed to validate message for channel "${channel}":`,
        error,
      );
      throw error;
    }
  }

  function createEmptyMessages(): ChannelMessages {
    console.log(
      "[createEmptyMessages] Creating empty messages for all channels",
    );
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(schemas)) {
      result[key] = [];
    }
    console.log("[createEmptyMessages] Created empty messages:", result);
    return result as ChannelMessages;
  }

  /**
   * Typed useChannel hook with auto-completed channel names and inferred payload types
   */
  function useChannel<C extends Channel>(channel: C) {
    console.log(
      `[useChannel] Hook called for channel "${channel}" with options:`,
      options,
    );

    const { wsUrl, authUrl } = options ?? {};
    const store = useErebusStore;
    const channelState = useChannelState();

    useEffect(() => {
      (async () => {
        console.log(`[useChannel:useEffect] Setting up channel "${channel}"`);

        // Initialize channel state
        channelState.setChannel(channel);
        channelState.setConnectionState("connecting");
        channelState.setConnecting(true);
        channelState.setConnected(false);
        channelState.setReadable(false);
        channelState.setWritable(false);
        channelState.resetReconnectAttempts();

        let authBaseUrl: string | undefined = authUrl;
        let wsBaseUrl: string | undefined = wsUrl;

        // Resolve authBaseUrl if not provided
        if (!authBaseUrl) {
          console.log(
            `[useChannel:useEffect] Resolving authBaseUrl for channel "${channel}"`,
          );
          if ((typeof window as any) !== "undefined" && window.location) {
            const { protocol, hostname, port } = window.location;
            let schema = protocol.replace(":", "");
            if (hostname === "localhost" || hostname === "127.0.0.1") {
              schema = "http";
            }
            authBaseUrl = `${schema}://${hostname}${port ? `:${port}` : ""}`;
            console.log(
              `[useChannel:useEffect] Resolved authBaseUrl for channel "${channel}":`,
              authBaseUrl,
            );
          } else {
            console.error(
              `[useChannel:useEffect] Failed to resolve authBaseUrl for channel "${channel}"`,
            );
            channelState.setConnectionState("error");
            channelState.setError(
              true,
              new Error("Unable to determine auth base URL"),
            );
            throw new Error(
              "ErebusClient: Unable to determine auth base URL. Please provide 'authUrl' explicitly, or run in a browser environment where it can be inferred from window.location.",
            );
          }
        } else {
          console.log(
            `[useChannel:useEffect] Using provided authBaseUrl for channel "${channel}":`,
            authBaseUrl,
          );
        }

        // Resolve wsBaseUrl if not provided
        if (!wsBaseUrl) {
          console.log(
            `[useChannel:useEffect] Resolving wsBaseUrl for channel "${channel}"`,
          );
          if (typeof window !== "undefined" && window.location) {
            const { protocol, hostname, port } = window.location;
            let wsSchema = protocol === "https:" ? "wss" : "ws";
            if (hostname === "localhost" || hostname === "127.0.0.1") {
              wsSchema = "ws";
            }
            wsBaseUrl = `${wsSchema}://${hostname}${port ? `:${port}` : ""}`;
            console.log(
              `[useChannel:useEffect] Resolved wsBaseUrl for channel "${channel}":`,
              wsBaseUrl,
            );
          } else {
            // fallback to default gateway if not in browser
            wsBaseUrl = "wss://gateway.erebus.sh";
            console.log(
              `[useChannel:useEffect] Using fallback wsBaseUrl for channel "${channel}":`,
              wsBaseUrl,
            );
          }
        } else {
          console.log(
            `[useChannel:useEffect] Using provided wsBaseUrl for channel "${channel}":`,
            wsBaseUrl,
          );
        }

        console.log(
          `[useChannel:useEffect] Creating ErebusPubSubClient for channel "${channel}"`,
        );
        const pubsubClient = ErebusClient.createClientSync({
          client: ErebusClientState.PubSub,
          authBaseUrl,
          wsBaseUrl,
        });

        // Join the channel before using the client
        console.log(`[useChannel:useEffect] Joining channel "${channel}"`);
        pubsubClient.joinChannel(channel);

        // Auto-connect after joining the channel so publish/subscribe work
        // in React environments without requiring manual connect calls.
        console.log(
          `[useChannel:useEffect] Connecting to channel "${channel}"`,
        );

        try {
          await pubsubClient.connect();
          console.log(
            `[useChannel:useEffect] Successfully connected to channel "${channel}"`,
          );
          channelState.setConnectionState("connected");
          channelState.setConnected(true);
          channelState.setConnecting(false);
          channelState.setReadable(true);
          channelState.setWritable(true);
          channelState.resetReconnectAttempts();
          channelState.updateActivity();

          // Get the real connection ID from the pubsub client
          const connectionId =
            pubsubClient.connectionHealth.connectionDetails.connectionId;
          channelState.setConnectionId(connectionId);
        } catch (error) {
          if (error instanceof Error) {
            console.error(
              `[useChannel:useEffect] Connect failed for channel "${channel}"`,
              error,
            );
            channelState.setConnectionState("error");
            channelState.setConnected(false);
            channelState.setConnecting(false);
            channelState.setReadable(false);
            channelState.setWritable(false);
            channelState.setError(true, error);
            channelState.incrementReconnectAttempts();
          }
        }

        // Set up event-driven state synchronization instead of polling
        const syncConnectionState = () => {
          try {
            const health = pubsubClient.connectionHealth;
            const connectionDetails = health.connectionDetails;

            // Update channel state based on actual connection state
            channelState.setConnected(health.isConnected);
            channelState.setReadable(health.isReadable);
            channelState.setWritable(health.isWritable);

            // Update connection state based on actual state
            const actualState = health.state;
            if (actualState === "open") {
              channelState.setConnectionState("connected");
            } else if (actualState === "connecting") {
              channelState.setConnectionState("connecting");
            } else if (actualState === "closed") {
              channelState.setConnectionState("disconnected");
            } else if (actualState === "idle") {
              channelState.setConnectionState("disconnected");
            }

            // Update activity and connection details
            if (health.isConnected) {
              channelState.updateActivity();
            }

            channelState.setConnectionId(connectionDetails.connectionId);

            if (options?.debug) {
              console.log(
                `[useChannel:stateSync] Channel "${channel}" state updated:`,
                {
                  connectionState: health.state,
                  isConnected: health.isConnected,
                  isReadable: health.isReadable,
                  isWritable: health.isWritable,
                  subscriptionCount: health.subscriptionCount,
                },
              );
            }
          } catch (error) {
            console.warn(
              `[useChannel:stateSync] Error syncing state for channel "${channel}":`,
              error,
            );
          }
        };

        // Initial sync
        syncConnectionState();

        // Set up periodic sync with a much longer interval for safety (only as backup)
        const stateSyncInterval = setInterval(syncConnectionState, 10000); // Every 10 seconds as backup

        console.log(
          `[useChannel:useEffect] Setting pubsub client in store for channel "${channel}"`,
        );
        store.getState().setPubsub(pubsubClient);

        return () => {
          console.log(
            `[useChannel:useEffect:cleanup] Cleaning up channel "${channel}"`,
          );

          // Clear the state sync interval
          clearInterval(stateSyncInterval);

          // Update state before cleanup
          channelState.setConnectionState("disconnected");
          channelState.setConnected(false);
          channelState.setConnecting(false);
          channelState.setReadable(false);
          channelState.setWritable(false);
          channelState.setConnectionId(null);
          channelState.clearAllSubscriptions();

          pubsubClient.close?.();
          store.getState().setPubsub(null);
          console.log(
            `[useChannel:useEffect:cleanup] Cleanup completed for channel "${channel}"`,
          );
        };
      })();
    }, [channel, wsUrl, authUrl]);

    type ChannelPayload = Payload<C>;

    // TODO: Localy check if it's subscribed to the topic and if not, subscribe to it manually i guess? or throw an error?
    const publish = useCallback(
      (topic: string, payload: ChannelPayload) => {
        console.log(
          `[useChannel:publish] Publishing to topic "${topic}" on channel "${channel}" with payload:`,
          payload,
        );

        const pubsub = store.getState().pubsub;
        if (!pubsub) {
          console.error(
            `[useChannel:publish] Pubsub not initialized for channel "${channel}"`,
          );
          throw new Error("ErebusClient: Pubsub not initialized");
        }

        // Check if connection is writable using both channel state and actual connection state
        const cs = useChannelState.getState();
        if (!cs.isWritable || !pubsub.isWritable) {
          console.error(
            `[useChannel:publish] Connection not writable for channel "${channel}"`,
            {
              channelStateWritable: cs.isWritable,
              actualConnectionWritable: pubsub.isWritable,
              connectionState: pubsub.connectionState,
            },
          );
          throw new Error("ErebusClient: Connection not writable");
        }

        const stringifiedPayload = JSON.stringify(payload);
        if (!stringifiedPayload) {
          console.error(
            `[useChannel:publish] Payload is empty for channel "${channel}"`,
          );
          throw new Error("ErebusClient: Payload is empty");
        }

        console.log(
          `[useChannel:publish] Publishing message to topic "${topic}" on channel "${channel}":`,
          stringifiedPayload,
        );

        // Update activity and set being sent state
        const cs2 = useChannelState.getState();
        cs2.setBeingSent(true);
        cs2.updateActivity();

        try {
          pubsub.publish({
            topic,
            messageBody: stringifiedPayload,
          });
          console.log(
            `[useChannel:publish] Successfully published to topic "${topic}" on channel "${channel}"`,
          );
        } finally {
          useChannelState.getState().setBeingSent(false);
        }
      },
      [channel],
    );

    const unsubscribe = useCallback(
      (topic: string) => {
        console.log(
          `[useChannel:unsubscribe] Unsubscribing from topic "${topic}" on channel "${channel}"`,
        );
        const pubsub = store.getState().pubsub;
        if (!pubsub) {
          console.error(
            `[useChannel:unsubscribe] Pubsub not initialized for channel "${channel}"`,
          );
          throw new Error("ErebusClient: Pubsub not initialized");
        }
        pubsub.unsubscribe(topic);
      },
      [channel],
    );

    const subscribe = useCallback(
      async (
        topic: string,
        callback: (data: {
          id: string;
          topic: string;
          senderId: string;
          seq: string;
          sentAt: Date;
          payload: ChannelPayload;
        }) => void,
      ) => {
        console.log(
          `[useChannel:subscribe] Subscribing to topic "${topic}" on channel "${channel}"`,
        );

        const pubsub = store.getState().pubsub;
        if (!pubsub) {
          console.error(
            `[useChannel:subscribe] Pubsub not initialized for channel "${channel}"`,
          );
          throw new Error("ErebusClient: Pubsub not initialized");
        }

        // Check if connection is readable using both channel state and actual connection state
        const cs = useChannelState.getState();
        if (!cs.isReadable || !pubsub.isReadable) {
          for (let i = 0; i < 5; i++) {
            console.error(
              `[useChannel:subscribe] Connection not readable for channel "${channel}" (attempt ${i + 1}/5)`,
              {
                channelStateReadable: cs.isReadable,
                actualConnectionReadable: pubsub.isReadable,
                connectionState: pubsub.connectionState,
              },
            );
            // Wait for 5 seconds
            const wait = (ms: number) =>
              new Promise<void>((resolve) => setTimeout(resolve, ms));
            // eslint-disable-next-line no-await-in-loop
            await wait(1000);
          }
          throw new Error(
            "ErebusClient: Connection not readable after 5 attempts",
          );
        }

        // Idempotency: if already subscribed, no-op and return a stable noop unsubscribe
        const currentStatus =
          useChannelState.getState().status.subscriptions[topic] ??
          "unsubscribed";
        if (currentStatus === "subscribed") {
          console.log(
            `[useChannel:subscribe] Skipping because status is already "${currentStatus}" for topic "${topic}" on channel "${channel}"`,
          );
          return () => {
            /* no-op: caller attempted duplicate subscribe */
          };
        }

        console.log(
          `[useChannel:subscribe] Setting up subscription for topic "${topic}" on channel "${channel}"`,
        );

        pubsub.subscribe(topic, (msg) => {
          console.log(
            `[useChannel:subscribe:callback] Received message on topic "${topic}" for channel "${channel}":`,
            msg,
          );

          // Update activity when message is received
          useChannelState.getState().updateActivity();

          let parsed: unknown = msg.payload;
          if (typeof msg.payload === "string") {
            try {
              parsed = JSON.parse(msg.payload);
              console.log(
                `[useChannel:subscribe:callback] Successfully parsed JSON payload for topic "${topic}" on channel "${channel}":`,
                parsed,
              );
            } catch {
              parsed = msg.payload; // fallback to raw string
              console.log(
                `[useChannel:subscribe:callback] JSON parsing failed, using raw string for topic "${topic}" on channel "${channel}":`,
                parsed,
              );
            }
          }

          const parsedPayload = parsed as ChannelPayload;
          const callbackData = {
            id: msg.id,
            topic: msg.topic,
            senderId: msg.senderId,
            seq: msg.seq,
            sentAt: new Date(msg.sentAt),
            payload: parsedPayload,
          };

          console.log(
            `[useChannel:subscribe:callback] Calling callback for topic "${topic}" on channel "${channel}" with data:`,
            callbackData,
          );
          callback(callbackData);
        });

        // Mark as subscribed after successful subscription (idempotent)
        const afterStatus =
          useChannelState.getState().status.subscriptions[topic] ??
          "unsubscribed";
        if (afterStatus !== "subscribed") {
          useChannelState.getState().setSubscriptionStatus(topic, "subscribed");
        }

        return () => {};
      },
      [channel],
    );

    // Get the reactive status object from channel state
    const status = channelState.status;

    console.log(
      `[useChannel] Returning publish, subscribe, and reactive status for channel "${channel}"`,
    );
    return {
      publish,
      unsubscribe,
      subscribe,
      status, // This is the new reactive status object that eliminates polling
    };
  }

  console.log(
    "[createErebus] Returning functions: useChannel, parse, validateMessage, createEmptyMessages",
  );
  return {
    useChannel,
    parse,
    validateMessage,
    createEmptyMessages,
  };
}
