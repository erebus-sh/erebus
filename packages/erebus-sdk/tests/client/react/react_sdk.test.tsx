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
  const { messages, publish } = useChannel("test_channel");

  return (
    <>
      <input type="text" />
      <button>Send</button>
    </>
  );
}

export function Notifications() {
  const { messages, publish } = useChannel("notification_inbox");

  return <div>Notifications</div>;
}

const authBaseUrl = "http://localhost:6969";
const wsBaseUrl = "ws://localhost:8787";

test("React SDK - Chat Channel", () => {
  render(<Chat />, {
    wrapper: ({ children }) => (
      <ErebusProvider authBaseUrl={authBaseUrl} wsBaseUrl={wsBaseUrl}>
        <TopicProvider topic="test_channel">{children}</TopicProvider>
      </ErebusProvider>
    ),
  });
});

test("React SDK - Notification Channel", () => {
  render(<Notifications />, {
    wrapper: ({ children }) => (
      <ErebusProvider authBaseUrl={authBaseUrl} wsBaseUrl={wsBaseUrl}>
        <TopicProvider topic="user_id132">{children}</TopicProvider>
      </ErebusProvider>
    ),
  });
});
