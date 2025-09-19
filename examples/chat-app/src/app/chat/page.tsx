"use client";

import { useChannel } from "@/erebus/client";

export default function ChatPage() {
  {
    /**
 Use the useChannel hook to access publish, presence, messages, isError, and error
 The hook is fully typed and auto completes based on the schema you defined
 */
  }
  const { publish, presence, messages, isError, error } = useChannel("chat");
  return (
    <>
      <div>
        <h1>Chat</h1>
      </div>
      <div>
        <h2>Messages</h2>
        {messages.map((message) => (
          <div key={message.seq}>{message.payload.message}</div>
        ))}
      </div>
    </>
  );
}
