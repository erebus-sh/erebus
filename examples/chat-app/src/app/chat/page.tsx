"use client";

import { useChannel } from "@/erebus/client";

export default function ChatPage() {
  {
    /**
 Use the useChannel hook to access chronologically ordered messages with discriminated union
 Messages include both sent and received in proper chat order with status tracking
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

        {/* All messages in chronological order */}
        {messages.map((message) => {
          if (message.type === "received") {
            return (
              <div key={message.id} className="message received">
                <span className="message-text">{message.payload.message}</span>
              </div>
            );
          }

          // TypeScript now knows this is a sent message
          const sentMessage = message; // This has SentMessage type
          return (
            <div key={sentMessage.localId} className="message sent">
              <span className="message-text">
                {sentMessage.payload.message}
              </span>
              <span className="message-status">
                {sentMessage.status === "sending" && "⏳"}
                {sentMessage.status === "sent" && "✓"}
                {sentMessage.status === "failed" && "✗"}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}
