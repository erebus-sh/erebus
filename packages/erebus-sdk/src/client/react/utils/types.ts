import { z } from "zod";
import type { MessageBody } from "@repo/schemas/messageBody";

export type AnySchema = z.ZodTypeAny;

export type ChannelName<S extends Record<string, AnySchema>> = keyof S & string;

export interface CreateErebusOptions {
  wsUrl?: string;
  authUrl?: string;
  debug?: boolean; // Enable verbose logging for debugging
}

// Generic helper types - maintain the original type structure
export type Channel<S extends Record<string, AnySchema>> = ChannelName<S>;
export type Payload<
  S extends Record<string, AnySchema>,
  C extends keyof S & string,
> = z.infer<S[C]>;
export type MetaWithPayload<
  S extends Record<string, AnySchema>,
  C extends keyof S & string,
> = MessageBody & {
  payload: Payload<S, C>;
};
export type ChannelMessages<S extends Record<string, AnySchema>> = {
  [K in keyof S & string]: MetaWithPayload<S, K>[];
};
