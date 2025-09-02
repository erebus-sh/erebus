import type { AnySchema, CreateErebusOptions } from "./types";
import {
  createParse,
  createValidateMessage,
  createEmptyMessages,
} from "./helpers";
import { createUseChannel } from "./createUseChannel";
import {
  useAutoSubscribe,
  useMessagePublisher,
  useMessagesState,
  useMessagesStatusSync,
} from "../hooks";

export function createErebus<S extends Record<string, AnySchema>>(
  schemas: S,
  options?: CreateErebusOptions,
) {
  console.log(
    "[createErebus] Function called with schemas:",
    Object.keys(schemas),
  );

  // Create the helper functions with the schemas
  const parse = createParse(schemas);
  const validateMessage = createValidateMessage(schemas);

  // Create the useChannel hook with the schemas and options
  const useChannel = createUseChannel(schemas, options);

  // Create empty messages function
  const createEmptyMessagesFn = () => createEmptyMessages(schemas);

  // Create the useSubscribe hook with full type safety
  function useSubscribe<C extends keyof S & string>(
    channel: C,
    topic: string,
    onPresence?: (presence: {
      clientId: string;
      topic: string;
      status: "online" | "offline";
      timestamp: number;
    }) => void,
  ) {
    const { subscribe, publishWithAck, unsubscribe, status, messagesMap } =
      useChannel(channel);
    const roomStatus = status.subscriptions[topic] || "unsubscribed";

    const messages = useAutoSubscribe(
      schemas,
      subscribe,
      unsubscribe,
      topic,
      status.isReady,
      roomStatus,
      onPresence,
    );

    // Use primitive hooks to manage complex state and logic
    const {
      messages: outgoingMessageState,
      addMessage,
      updateMessageStatus,
      updateMessageClientId,
    } = useMessagesState();

    // Sync message statuses from messagesMap
    useMessagesStatusSync(
      outgoingMessageState,
      messagesMap,
      updateMessageStatus,
    );

    // Publisher with ack status tracking - now type-safe!
    const { publishAck } = useMessagePublisher(
      schemas,
      publishWithAck,
      addMessage,
      updateMessageStatus,
      updateMessageClientId,
    );

    return {
      messages,
      publishAck,
      subscriptionStatus: status.subscriptions[topic],
      connectionStatus: status.connectionState,
      isReady: status.isReady,
      messagesMap,
    };
  }

  console.log(
    "[createErebus] Returning functions: useChannel, useSubscribe, parse, validateMessage, createEmptyMessages",
  );
  return {
    useChannel,
    useSubscribe,
    parse,
    validateMessage,
    createEmptyMessages: createEmptyMessagesFn,
  };
}
