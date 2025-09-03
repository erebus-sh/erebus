"use client";

import React, { createContext, useContext, useEffect, useRef } from "react";
import type { AnySchema, CreateErebusOptions } from "../utils/types";
import { ErebusClient, ErebusClientState } from "@/client/core/Erebus";
import { getGrant, setGrant } from "../cache/localStorage";
import { createRoomStore, type RoomStore } from "./roomStore";

export interface RoomContextValue<S extends Record<string, AnySchema>> {
  store: RoomStore<S>;
  schemas: S;
  channel: string;
}

const RoomContext = createContext<RoomContextValue<any> | null>(null);

export function useRoomContext<
  S extends Record<string, AnySchema>,
>(): RoomContextValue<S> {
  const context = useContext(RoomContext);
  if (!context) {
    throw new Error("useRoomContext must be used within a RoomProvider");
  }
  return context;
}

export interface RoomProviderProps<S extends Record<string, AnySchema>> {
  children: React.ReactNode;
  schemas: S;
  channel: string;
  options?: CreateErebusOptions;
}

export function RoomProvider<S extends Record<string, AnySchema>>({
  children,
  schemas,
  channel,
  options = {},
}: RoomProviderProps<S>) {
  const storeRef = useRef<RoomStore<S> | null>(null);
  const clientRef = useRef<any>(null);

  // Initialize store once
  if (!storeRef.current) {
    storeRef.current = createRoomStore<S>(schemas, channel);
  }

  const store = storeRef.current;

  useEffect(() => {
    let mounted = true;

    async function initializeRoom() {
      if (!mounted) return;

      console.log(`[RoomProvider] Initializing room "${channel}"`);

      // Set initial state
      store.getState().setChannel(channel);
      store.getState().setConnectionState("connecting");

      try {
        const { wsUrl, authUrl } = options;

        // Resolve URLs
        let resolvedAuthUrl = authUrl;
        let resolvedWsUrl = wsUrl;

        if (!resolvedAuthUrl && typeof window !== "undefined") {
          const { protocol, hostname, port } = window.location;
          const schema =
            hostname === "localhost" || hostname === "127.0.0.1"
              ? "http"
              : protocol.replace(":", "");
          resolvedAuthUrl = `${schema}://${hostname}${port ? `:${port}` : ""}`;
        }

        if (!resolvedWsUrl && typeof window !== "undefined") {
          const { protocol, hostname, port } = window.location;
          const wsSchema = protocol === "https:" ? "wss" : "ws";
          if (hostname === "localhost" || hostname === "127.0.0.1") {
            resolvedWsUrl = `ws://${hostname}${port ? `:${port}` : ""}`;
          } else {
            resolvedWsUrl = `${wsSchema}://${hostname}${port ? `:${port}` : ""}`;
          }
        }

        if (!resolvedWsUrl) {
          resolvedWsUrl = "wss://gateway.erebus.sh";
        }

        // Create client
        const client = ErebusClient.createClientSync({
          client: ErebusClientState.PubSub,
          authBaseUrl: resolvedAuthUrl!,
          wsBaseUrl: resolvedWsUrl,
          grantCacheLayer: () => {
            const grant = getGrant();
            return grant ? Promise.resolve(grant) : Promise.resolve(undefined);
          },
          cacheGrant: setGrant,
        });

        if (!mounted) return;

        clientRef.current = client;
        store.getState().setClient(client);

        // Join channel and connect
        client.joinChannel(channel);
        await client.connect();

        if (!mounted) return;

        // Update connection state
        store.getState().setConnectionState("connected");
        store.getState().setConnectionDetails({
          isConnected: true,
          isReadable: true,
          isWritable: true,
          connectionId: client.connectionHealth.connectionDetails.connectionId,
        });

        console.log(
          `[RoomProvider] Successfully connected to room "${channel}"`,
        );
      } catch (error) {
        if (!mounted) return;

        console.error(
          `[RoomProvider] Failed to connect to room "${channel}":`,
          error,
        );
        store.getState().setConnectionState("error");
        store
          .getState()
          .setError(error instanceof Error ? error : new Error(String(error)));
      }
    }

    initializeRoom();

    return () => {
      mounted = false;
      console.log(`[RoomProvider] Cleaning up room "${channel}"`);

      if (clientRef.current) {
        try {
          clientRef.current.close?.();
        } catch (error) {
          console.warn(`[RoomProvider] Error during cleanup:`, error);
        }
      }

      // Reset state
      store.getState().setConnectionState("disconnected");
      store.getState().setConnectionDetails({
        isConnected: false,
        isReadable: false,
        isWritable: false,
        connectionId: null,
      });
    };
  }, [channel, options.wsUrl, options.authUrl]);

  const contextValue: RoomContextValue<S> = {
    store,
    schemas,
    channel,
  };

  return (
    <RoomContext.Provider value={contextValue}>{children}</RoomContext.Provider>
  );
}
