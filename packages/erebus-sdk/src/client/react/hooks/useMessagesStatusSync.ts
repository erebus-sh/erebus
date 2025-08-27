import { useEffect } from "react";

// Primitive hook for syncing message statuses from messagesMap
export function useMessagesStatusSync(
  messages: Array<{
    id: string;
    content: string;
    status: "sending" | "sent" | "error" | "timeout";
    clientMsgId?: string;
  }>,
  messagesMap: Record<
    string,
    { clientMsgId: string; status: "sent" | "error" | "timeout" }
  >,
  updateMessageStatus: (
    messageId: string,
    status: "sending" | "sent" | "error" | "timeout",
  ) => void,
) {
  useEffect(() => {
    messages.forEach((msg) => {
      if (msg.clientMsgId && messagesMap[msg.clientMsgId]) {
        const mapEntry = messagesMap[msg.clientMsgId];
        if (mapEntry) {
          const mapStatus = mapEntry.status;
          // Map the status from messagesMap to our UI status
          const uiStatus =
            mapStatus === "sent"
              ? "sent"
              : mapStatus === "error"
                ? "error"
                : mapStatus === "timeout"
                  ? "timeout"
                  : msg.status;
          if (uiStatus !== msg.status) {
            console.log(
              `Updating message ${msg.id} status from ${msg.status} to ${uiStatus}`,
            );
            updateMessageStatus(msg.id, uiStatus);
          }
        }
      }
    });
  }, [messages, messagesMap, updateMessageStatus]);
}
