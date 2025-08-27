import { useState, useCallback } from "react";

// Primitive hook for managing messages with status tracking
export function useMessagesState() {
  const [messages, setMessages] = useState<
    {
      id: string;
      content: string;
      status: "sending" | "sent" | "error" | "timeout";
      clientMsgId?: string;
    }[]
  >([]);

  const addMessage = useCallback(
    (
      content: string,
      status: "sending" | "sent" | "error" | "timeout" = "sending",
    ) => {
      const messageId = Date.now().toString();
      setMessages((prev) => [
        ...prev,
        {
          id: messageId,
          content,
          status,
        },
      ]);
      return messageId;
    },
    [],
  );

  const updateMessageStatus = useCallback(
    (messageId: string, status: "sending" | "sent" | "error" | "timeout") => {
      setMessages((prev) =>
        prev.map((msg) => (msg.id === messageId ? { ...msg, status } : msg)),
      );
    },
    [],
  );

  const updateMessageClientId = useCallback(
    (messageId: string, clientMsgId: string) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId ? { ...msg, clientMsgId } : msg,
        ),
      );
    },
    [],
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    addMessage,
    updateMessageStatus,
    updateMessageClientId,
    clearMessages,
  };
}
