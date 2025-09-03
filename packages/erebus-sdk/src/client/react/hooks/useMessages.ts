"use client";

import { useCallback } from "react";
import { useStore } from "zustand";
import { useRoomContext } from "../provider/RoomProvider";
import type { AnySchema } from "../utils/types";
import type {
  MessageStatus,
  Message,
  OutgoingMessage,
} from "../provider/roomStore";

// Stable empty arrays to avoid new references when no data
const EMPTY_INCOMING: Message[] = [];
const EMPTY_OUTGOING: OutgoingMessage[] = [];

export function useMessages<
  S extends Record<string, AnySchema> = Record<string, never>,
>(topic?: string) {
  const { store } = useRoomContext<S>();

  // Get messages for topic (incoming) and outgoing message tracking
  const incomingMessages = useStore(store, (state) =>
    topic ? state.getTopicMessages(topic) : EMPTY_INCOMING,
  );
  const outgoingMessages = useStore(
    store,
    (state) => state.outgoingMessages ?? EMPTY_OUTGOING,
  );

  // Message management functions
  const addMessage = useCallback(
    (content: string, status: MessageStatus = "sending") => {
      return store.getState().addOutgoingMessage(content, status);
    },
    [store],
  );

  const updateMessage = useCallback(
    (id: string, updates: { status?: MessageStatus; clientMsgId?: string }) => {
      store.getState().updateOutgoingMessage(id, updates);
    },
    [store],
  );

  const clearMessages = useCallback(() => {
    store.getState().clearMessages(topic);
  }, [store, topic]);

  // Get all messages (both incoming and outgoing) sorted by timestamp
  const allMessages = useCallback(() => {
    const incoming = incomingMessages.map((msg: Message) => ({
      ...msg,
      type: "incoming" as const,
      timestamp: msg.sentAt,
    }));

    const outgoing = outgoingMessages.map((msg: OutgoingMessage) => ({
      // Normalize outgoing messages to match incoming message structure
      id: msg.id,
      topic: topic || "", // Use the topic parameter
      senderId: "local", // Local messages don't have a real senderId
      seq: msg.clientMsgId || msg.id, // Use clientMsgId or fallback to id
      sentAt: msg.timestamp, // Map timestamp to sentAt for compatibility
      payload: { message: msg.content }, // Map content to payload.message
      type: "outgoing" as const,
      timestamp: msg.timestamp,
      status: msg.status, // Keep the status for UI purposes
    }));

    return [...incoming, ...outgoing].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
    );
  }, [incomingMessages, outgoingMessages, topic]);

  return {
    // Individual message arrays
    incomingMessages,
    outgoingMessages,

    // Combined and sorted messages
    allMessages: allMessages(),

    // Management functions
    addMessage,
    updateMessage,
    clearMessages,
  };
}
