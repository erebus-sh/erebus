export const DEFAULT_HEARTBEAT_MS = 25_000;
export const MAX_BUFFERED = 1_000_000; // 1MB
export const OPS = {
  AUTH: "auth",
  SUB: "sub",
  UNSUB: "unsub",
  PUB: "pub",
  PING: "ping",
  ACK: "ack",
  ERR: "err",
  MSG: "msg",
} as const;
