import type { AnySchema, CreateErebusOptions } from "./types";
import {
  createParse,
  createValidateMessage,
  createEmptyMessages,
} from "./helpers";
import { createUseChannel } from "./hooks";

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

  // Create the useChannel hook with the options
  const useChannel = createUseChannel(options);

  // Create empty messages function
  const createEmptyMessagesFn = () => createEmptyMessages(schemas);

  console.log(
    "[createErebus] Returning functions: useChannel, parse, validateMessage, createEmptyMessages",
  );
  return {
    useChannel,
    parse,
    validateMessage,
    createEmptyMessages: createEmptyMessagesFn,
  };
}
