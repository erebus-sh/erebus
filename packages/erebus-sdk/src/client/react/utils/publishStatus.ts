import type { ErebusError } from "@/internal/error";

export type PublishOptions = {
  maxRetries?: number; // default 2
  baseDelayMs?: number; // default 250 (exp backoff)
};

export type SendStatus = "idle" | "sending" | "success" | "failed";

export type PerMessageStatus = {
  id: string;
  status: SendStatus;
  attempts: number;
  error: ErebusError | null;
};
