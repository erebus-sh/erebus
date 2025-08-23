import type { MessageBody } from "@repo/schemas/messageBody";
import type { PacketEnvelope } from "@repo/schemas/packetEnvelope";
import type { AckCallback } from "../types";
import { PubSubConnection } from "./PubSubConnectionNew";
import { logger } from "@/internal/logger/consola";
import consola from "consola";

export type ErebusOptions = {
  wsUrl: string;
  tokenProvider: (channel: string) => Promise<string>;
  heartbeatMs?: number;
  log?: (l: "info" | "warn" | "error", msg: string, meta?: unknown) => void;
  debug?: boolean;
};

export type Handler = (
  payload: MessageBody,
  meta: { topic: string; seq: string; ts: number },
) => void;

/**
 * Refactored ErebusPubSub client using modular architecture
 */
export class ErebusPubSubClientNew {
  #conn: PubSubConnection;
  #handlers = new Map<string, Set<Handler>>();
  #instanceId: string;
  #processedMessages = new Set<string>();
  #pendingSubscriptions = new Set<string>();
  #channel: string | null = null;
  #debug: boolean;

  constructor(opts: ErebusOptions) {
    this.#instanceId = Math.random().toString(36).substring(2, 8);
    this.#debug = opts.debug ?? false;

    consola.info(`[Erebus:${this.#instanceId}] Constructor called`, {
      wsUrl: opts.wsUrl,
      heartbeatMs: opts.heartbeatMs,
      hasTokenProvider: !!opts.tokenProvider,
      hasCustomLog: !!opts.log,
    });

    logger.info("Erebus constructor called", { opts });

    this.#conn = new PubSubConnection({
      url: opts.wsUrl,
      tokenProvider: opts.tokenProvider,
      channel: this.#channel || "",
      heartbeatMs: opts.heartbeatMs,
      log: opts.log,
      onMessage: (m: PacketEnvelope) => this.#handleMessage(m),
    });

    consola.info(`[Erebus:${this.#instanceId}] Instance created successfully`, {
      wsUrl: opts.wsUrl,
    });
    logger.info("Erebus instance created", { wsUrl: opts.wsUrl });
  }

  connect(timeout?: number) {
    consola.info(`[Erebus:${this.#instanceId}] Connect called`, { timeout });
    logger.info("Erebus.connect() called");

    if (!this.#channel) {
      const error =
        "Channel must be set before connecting. Call joinChannel(channel) first.";
      consola.error(`[Erebus:${this.#instanceId}] ${error}`);
      logger.error("Connect failed - no channel set");
      throw new Error(error);
    }

    this.#processedMessages.clear();
    return this.#conn.open(timeout);
  }

  joinChannel(channel: string) {
    consola.info(`[Erebus:${this.#instanceId}] Joining channel`, { channel });
    logger.info("Erebus.joinChannel() called", { channel });

    if (
      !channel ||
      typeof channel !== "string" ||
      channel.trim().length === 0
    ) {
      const error = "Invalid channel: must be a non-empty string";
      consola.error(`[Erebus:${this.#instanceId}] ${error}`, { channel });
      logger.error("Invalid channel", { channel });
      throw new Error(error);
    }

    this.#channel = channel;
    this.#conn.setChannel(channel);
  }

  subscribe(topic: string, handler: Handler) {
    consola.info(`[Erebus:${this.#instanceId}] Subscribe called`, { topic });
    logger.info("Erebus.subscribe() called", { topic });

    if (!this.#channel) {
      const error =
        "Channel must be set before subscribing. Call joinChannel(channel) first.";
      consola.error(`[Erebus:${this.#instanceId}] ${error}`, { topic });
      logger.error("Subscribe failed - no channel set", { topic });
      throw new Error(error);
    }

    if (!topic || typeof topic !== "string" || topic.trim().length === 0) {
      const error = "Invalid topic: must be a non-empty string";
      consola.error(`[Erebus:${this.#instanceId}] ${error}`, { topic });
      logger.error("Invalid topic", { topic });
      throw new Error(error);
    }

    if (typeof handler !== "function") {
      const error = "Invalid handler: must be a function";
      consola.error(`[Erebus:${this.#instanceId}] ${error}`);
      logger.error("Invalid handler", { handlerType: typeof handler });
      throw new Error(error);
    }

    if (!this.#handlers.has(topic)) {
      this.#handlers.set(topic, new Set());
    }
    this.#handlers.get(topic)!.add(handler);

    this.#pendingSubscriptions.add(topic);
    this.#conn.subscribe(topic);
  }

  unsubscribe(topic: string) {
    consola.info(`[Erebus:${this.#instanceId}] Unsubscribe called`, { topic });
    logger.info("Unsubscribe function called", { topic });

    if (!topic || typeof topic !== "string" || topic.trim().length === 0) {
      const error = "Invalid topic: must be a non-empty string";
      consola.error(`[Erebus:${this.#instanceId}] ${error}`, { topic });
      logger.error("Invalid topic", { topic });
      throw new Error(error);
    }

    const set = this.#handlers.get(topic);
    if (!set) {
      consola.warn(
        `[Erebus:${this.#instanceId}] No handler set found during unsubscribe`,
        { topic },
      );
      logger.warn("No handler set found during unsubscribe", { topic });
      return;
    }

    set.clear();
    this.#handlers.delete(topic);
    this.#pendingSubscriptions.delete(topic);
    this.#conn.unsubscribe(topic);
  }

  publish({
    topic,
    messageBody,
  }: {
    topic: string;
    messageBody: string;
  }): Promise<void> {
    return this.#publishInternal(topic, messageBody, false);
  }

  publishWithAck({
    topic,
    messageBody,
    onAck,
    timeoutMs = 30000,
  }: {
    topic: string;
    messageBody: string;
    onAck: AckCallback;
    timeoutMs?: number;
  }): Promise<void> {
    return this.#publishInternal(topic, messageBody, true, onAck, timeoutMs);
  }

  close() {
    consola.info(`[Erebus:${this.#instanceId}] Close called`);
    logger.info("Erebus.close() called");
    this.#conn.close();
  }

  // Getters
  get connectionState(): string {
    return this.#conn.state;
  }

  get isConnected(): boolean {
    return this.#conn.isConnected;
  }

  get channel(): string | null {
    return this.#channel;
  }

  #publishInternal(
    topic: string,
    messageBody: string,
    withAck: boolean = false,
    onAck?: AckCallback,
    timeoutMs?: number,
  ): Promise<void> {
    // Validation logic here (same as original)
    if (!this.#channel) {
      throw new Error(
        "Channel must be set before publishing. Call joinChannel(channel) first.",
      );
    }

    if (!topic || typeof topic !== "string" || topic.trim().length === 0) {
      throw new Error("Invalid topic: must be a non-empty string");
    }

    if (typeof messageBody !== "string") {
      throw new Error("Invalid messageBody: must be a string");
    }

    if (withAck && !onAck) {
      throw new Error("ACK callback is required when using publishWithAck");
    }

    // Generate message payload
    const clientMsgId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const actualMessageBody: MessageBody = {
      id: "TO_BE_SAT",
      topic,
      senderId: "TO_BE_SAT",
      seq: "TO_BE_SAT",
      sentAt: new Date(),
      payload: messageBody,
      clientMsgId,
      clientPublishTs: Date.now(),
    };

    return new Promise<void>((resolve, reject) => {
      try {
        if (withAck && onAck && timeoutMs) {
          this.#conn.publishWithAck(actualMessageBody, onAck, timeoutMs);
        } else {
          this.#conn.publish(actualMessageBody);
        }
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  #handleMessage(m: PacketEnvelope): void {
    if (m.packetType !== "publish") {
      if (this.#debug) {
        consola.info(
          `[Erebus:${this.#instanceId}] Ignoring non-message packetType`,
          {
            packetType: m.packetType,
          },
        );
      }
      return;
    }

    const messageId = m.payload?.id || "unknown";

    // Check for duplicate messages
    if (this.#processedMessages.has(messageId)) {
      if (this.#debug) {
        consola.info(
          `[Erebus:${this.#instanceId}] Skipping duplicate message`,
          {
            messageId:
              messageId.length > 8
                ? `${messageId.substring(0, 4)}...${messageId.substring(messageId.length - 4)}`
                : messageId,
            topic: m.payload?.topic,
          },
        );
      }
      return;
    }

    this.#processedMessages.add(messageId);

    // Clean up old message IDs to prevent memory leaks
    if (this.#processedMessages.size > 1000) {
      const ids = Array.from(this.#processedMessages);
      this.#processedMessages.clear();
      ids.slice(-500).forEach((id) => this.#processedMessages.add(id));
    }

    const set = this.#handlers.get(m.payload?.topic || "");
    if (!set) {
      if (this.#debug) {
        consola.warn(
          `[Erebus:${this.#instanceId}] No handlers found for topic`,
          {
            topic: m.payload?.topic,
          },
        );
      }
      return;
    }

    for (const fn of set) {
      try {
        fn(m.payload!, {
          topic: m.payload!.topic,
          seq: m.payload!.seq,
          ts: m.payload!.sentAt.getTime(),
        });
      } catch (error) {
        if (this.#debug) {
          consola.error(
            `[Erebus:${this.#instanceId}] Error in message handler`,
            {
              error,
              topic: m.payload?.topic,
              messageId,
            },
          );
        }
      }
    }
  }
}
