import { logger } from "@/internal/logger/consola";
export type ErebusOptions = {
  wsUrl: string; // wss://...
  tokenProvider: () => Promise<string> | string; // calls EREBUS_GRANT_URL
  heartbeatMs?: number; // default 25_000
  log?: (l: "info" | "warn" | "error", msg: string, meta?: unknown) => void;
};

export type MessageMeta = {
  topic: string;
  seq?: string;
  ts?: number;
  region?: string;
};
export type Unsubscribe = () => void;

export function logTypeInfo(label: string, value: unknown) {
  logger.info("type info", { label, valueType: typeof value });
}
