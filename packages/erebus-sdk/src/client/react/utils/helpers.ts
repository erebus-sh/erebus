import { z } from "zod";
import type { MessageBody } from "@repo/schemas/messageBody";
import type { AnySchema } from "./types";

export function createParse<S extends Record<string, AnySchema>>(schemas: S) {
  return function parse<C extends keyof S & string>(
    channel: C,
    input: unknown,
  ): z.infer<S[C]> {
    console.log(`[parse] Parsing channel "${channel}" with input:`, input);
    const schema = schemas[channel] as AnySchema;
    try {
      const result = schema.parse(input) as z.infer<S[C]>;
      console.log(`[parse] Successfully parsed channel "${channel}":`, result);
      return result;
    } catch (error) {
      console.error(`[parse] Failed to parse channel "${channel}":`, error);
      throw error;
    }
  };
}

export function createValidateMessage<S extends Record<string, AnySchema>>(
  schemas: S,
) {
  const parse = createParse(schemas);

  return function validateMessage<C extends keyof S & string>(
    channel: C,
    body: MessageBody & { payload: unknown },
  ): Omit<MessageBody, "payload"> & { payload: z.infer<S[C]> } {
    console.log(
      `[validateMessage] Validating message for channel "${channel}":`,
      body,
    );

    // If payload is a string, try to parse it as JSON first
    let payloadToValidate = body.payload;
    if (typeof body.payload === "string") {
      try {
        payloadToValidate = JSON.parse(body.payload);
        console.log(
          `[validateMessage] Successfully parsed JSON payload for channel "${channel}":`,
          payloadToValidate,
        );
      } catch (error) {
        // If JSON parsing fails, use the string as-is
        console.log(
          `[validateMessage] JSON parsing failed for channel "${channel}", using string as-is:`,
          body.payload,
        );
        payloadToValidate = body.payload;
      }
    }

    try {
      const payload = parse(channel, payloadToValidate);
      const result = { ...body, payload };
      console.log(
        `[validateMessage] Successfully validated message for channel "${channel}":`,
        result,
      );
      return result;
    } catch (error) {
      console.error(
        `[validateMessage] Failed to validate message for channel "${channel}":`,
        error,
      );
      throw error;
    }
  };
}

export function createEmptyMessages<S extends Record<string, AnySchema>>(
  schemas: S,
): {
  [K in keyof S & string]: (Omit<MessageBody, "payload"> & {
    payload: z.infer<S[K]>;
  })[];
} {
  console.log("[createEmptyMessages] Creating empty messages for all channels");
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(schemas)) {
    result[key] = [];
  }
  console.log("[createEmptyMessages] Created empty messages:", result);
  return result as {
    [K in keyof S & string]: (Omit<MessageBody, "payload"> & {
      payload: z.infer<S[K]>;
    })[];
  };
}
