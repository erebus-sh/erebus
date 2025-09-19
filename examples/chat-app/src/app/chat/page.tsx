"use client";

import { useChannel } from "@/erebus/client";
import { useState } from "react";

export default function ChatPage() {
  {
    /**
 Use the useChannel hook to access chronologically ordered messages with discriminated union
 Messages include both sent and received in proper chat order with status tracking
 The hook is fully typed and auto completes based on the schema you defined
 */
  }
  const { publish, presence, messages, isError, error } = useChannel("chat");
  const [inputMessage, setInputMessage] = useState("");

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    try {
      await publish({
        message: inputMessage.trim(),
        sentAt: Date.now(),
      });
      setInputMessage(""); // Clear input after sending
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
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

      {/* Message Input */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          padding: "16px",
          backgroundColor: "white",
          borderTop: "1px solid #ccc",
          display: "flex",
          gap: "8px",
        }}
      >
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyDown={(e) => handleKeyPress(e)}
          placeholder="Type your message..."
          style={{
            flex: 1,
            padding: "12px",
            border: "1px solid #ddd",
            borderRadius: "4px",
            fontSize: "16px",
          }}
          disabled={isError} // Disable if there's an error
        />
        <button
          onClick={handleSendMessage}
          disabled={!inputMessage.trim() || isError}
          style={{
            padding: "12px 24px",
            backgroundColor:
              inputMessage.trim() && !isError ? "#007bff" : "#ccc",
            color: "white",
            border: "none",
            borderRadius: "4px",
            fontSize: "16px",
            cursor: inputMessage.trim() && !isError ? "pointer" : "not-allowed",
          }}
        >
          Send
        </button>
      </div>

      {/* Add bottom padding to prevent messages from being hidden behind input */}
      <div style={{ height: "80px" }} />
    </>
  );
}
