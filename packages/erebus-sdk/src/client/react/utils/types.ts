import { z } from "zod";

export type SchemaMap = Record<string, z.ZodType>; // Channel -> schema
export type Topic<S extends SchemaMap> = Extract<keyof S, string>; // Topics are the keys of the schema map
export type Payload<S extends SchemaMap, K extends Topic<S>> = z.infer<S[K]>; // Payloads are the inferred types of the schema map
