import { test, expect } from "vitest";
import { renderHook, render, act } from "@testing-library/react";
import { z } from "zod";
import { ErebusProvider } from "../../../src/client/react/provider/ErebusProvider";
import { TopicProvider } from "../../../src/client/react/provider/TopicProvider";
import { createChannel } from "../../../src/client/react/utils/createChannel";
import React from "react";

const schema = {
  test_channel: z.object({
    message: z.string(),
    sentAt: z.number(),
  }),
  notification_inbox: z.object({
    notification: z.string(),
    sentAt: z.number(),
  }),
};

const useChannel = createChannel(schema);

export function Chat() {
  // Uses "test_channel" schema for messages in this topic
  const { messages, publish } = useChannel("test_channel");

  return (
    <>
      <input type="text" />
      <button
        onClick={() =>
          publish({
            message: "Hello, world!",
            sentAt: Date.now(),
          })
        }
      >
        Send
      </button>
    </>
  );
}

export function Notifications() {
  // Uses "notification_inbox" schema for messages in this topic
  const { messages, publish } = useChannel("notification_inbox");

  return (
    <>
      <button
        onClick={() =>
          publish({
            notification: "[message] form [user]",
            sentAt: Date.now(),
          })
        }
      >
        Send
      </button>
    </>
  );
}

const authBaseUrl = "http://localhost:6969";
const wsBaseUrl = "ws://localhost:8787";

test("React SDK - Chat Channel", () => {
  // TopicProvider provides the conversation room (topic: "chat_room_123")
  // useChannel("test_channel") specifies which schema to use for validation
  render(<Chat />, {
    wrapper: ({ children }) => (
      <ErebusProvider authBaseUrl={authBaseUrl} wsBaseUrl={wsBaseUrl}>
        <TopicProvider topic="chat_room_123">{children}</TopicProvider>
      </ErebusProvider>
    ),
  });
});

test("React SDK - Notification Channel", () => {
  // TopicProvider provides the conversation room (topic: "user_notifications")
  // useChannel("notification_inbox") specifies which schema to use for validation
  render(<Notifications />, {
    wrapper: ({ children }) => (
      <ErebusProvider authBaseUrl={authBaseUrl} wsBaseUrl={wsBaseUrl}>
        <TopicProvider topic="user_notifications">{children}</TopicProvider>
      </ErebusProvider>
    ),
  });
});
