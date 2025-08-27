import { useCallback } from "react";
import type { AckResponse } from "@/client/core/types";

// Primitive hook for publishing messages with status tracking
export function useMessagePublisher(
  publishWithAck: (
    topic: string,
    payload: any,
    ackCallback?: (ack: AckResponse) => void,
  ) => Promise<{ clientMsgId: string; status: "sent" | "error" | "timeout" }>,
  addMessage: (
    content: string,
    status?: "sending" | "sent" | "error" | "timeout",
  ) => string,
  updateMessageStatus: (
    messageId: string,
    status: "sending" | "sent" | "error" | "timeout",
  ) => void,
  updateMessageClientId: (messageId: string, clientMsgId: string) => void,
) {
  const publishAck = useCallback(
    async (topic: string, payload: any, messageContent: string) => {
      console.log(
        "Publishing message with ack and UI tracking to topic:",
        topic,
      );

      // Add message with "sending" status
      const messageId = addMessage(messageContent);

      const startTime = Date.now();
      try {
        const result = await publishWithAck(topic, payload, (ack) => {
          const endTime = Date.now();
          const ms = endTime - startTime;
          console.log(
            "Received ack with clientMsgId",
            ack.ack.clientMsgId,
            `(${ms} ms elapsed)`,
          );
        });

        console.log(
          "Published message with clientMsgId",
          result.clientMsgId,
          "initial status:",
          result.status,
        );

        // Update message with clientMsgId for tracking
        updateMessageClientId(messageId, result.clientMsgId);

        return result;
      } catch (error) {
        console.error("Failed to publish message:", error);
        updateMessageStatus(messageId, "error");
        throw error;
      }
    },
    [publishWithAck, addMessage, updateMessageStatus, updateMessageClientId],
  );

  return { publishAck };
}
