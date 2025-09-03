"use client";

import React from "react";
import type { AnySchema, CreateErebusOptions } from "./types";
import { RoomProvider, type RoomProviderProps } from "../provider/RoomProvider";
import {
  createParse,
  createValidateMessage,
  createEmptyMessages,
} from "./helpers";

export function createErebus<S extends Record<string, AnySchema>>(
  schemas: S,
  defaultOptions?: CreateErebusOptions,
) {
  console.log(
    "[createErebus] Creating provider-based Erebus with schemas:",
    Object.keys(schemas),
  );

  // Create helper functions
  const parse = createParse(schemas);
  const validateMessage = createValidateMessage(schemas);
  const createEmptyMessagesFn = () => createEmptyMessages(schemas);

  // Create the provider component with pre-configured schemas
  function ErebusProvider<C extends keyof S & string>({
    children,
    channel,
    options,
  }: {
    children: React.ReactNode;
    channel: C;
    options?: CreateErebusOptions;
  }) {
    const mergedOptions = { ...defaultOptions, ...options };

    return (
      <RoomProvider schemas={schemas} channel={channel} options={mergedOptions}>
        {children}
      </RoomProvider>
    );
  }

  // Create room provider for multiple rooms
  function MultiRoomProvider({
    children,
    rooms,
    options,
  }: {
    children: React.ReactNode;
    rooms: Array<{
      channel: keyof S & string;
      options?: CreateErebusOptions;
    }>;
    options?: CreateErebusOptions;
  }) {
    const mergedOptions = { ...defaultOptions, ...options };

    // Nest providers for each room
    return rooms.reduceRight(
      (children, room) => (
        <ErebusProvider
          key={room.channel}
          channel={room.channel}
          options={{ ...mergedOptions, ...room.options }}
        >
          {children}
        </ErebusProvider>
      ),
      children,
    );
  }

  return {
    // Provider components
    ErebusProvider,
    MultiRoomProvider,

    // Utility functions
    parse,
    validateMessage,
    createEmptyMessages: createEmptyMessagesFn,

    // Schema access
    schemas,

    // For backwards compatibility, export the individual provider too
    RoomProvider: (props: Omit<RoomProviderProps<S>, "schemas">) => (
      <RoomProvider {...props} schemas={schemas} />
    ),
  };
}
