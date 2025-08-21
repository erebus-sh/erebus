import { encodeEnvelope, parseServerFrame } from "@/client/core/wire";
import type { PacketEnvelope } from "@/internal/schemas/packetEnvelope";
import type { MessageBody } from "@/internal/schemas/messageBody";
import { logger } from "@/internal/logger/consola";
import { validateWebSocketUrl } from "@/internal/validateWebSocketUrl";
import consola from "consola";
import { backoff } from "../backoff";

const GRANT_CACHE_KEY = "erebus:grant";

export class BackpressureError extends Error {}
export class NotConnectedError extends Error {}

type OnMessage = (msg: PacketEnvelope) => void;
type Logger = (
  l: "info" | "warn" | "error",
  msg: string,
  meta?: unknown,
) => void;

// Helper function to safely log sensitive data
function logSensitiveData(data: string, prefix: string = "data"): string {
  if (!data || data.length < 8) return `${prefix}: [too short]`;
  return `${prefix}: ${data.substring(0, 4)}...${data.substring(data.length - 4)}`;
}

export class PubSubConnection {
  #url: string;
  #getToken: (channel: string) => Promise<string>;
  #hbMs: number;
  #ws?: WebSocket;
  #retry = 0;
  #state: "idle" | "connecting" | "open" | "closed" = "idle";
  #subs = new Set<string>();
  #onMsg: OnMessage;
  #log: Logger;
  #hb?: NodeJS.Timeout;
  #connectionId: string;
  #autoReconnect: boolean;
  #channel: string;
  #debugHexDump: boolean;

  // Subscription tracking for optimistic updates
  #subscribedTopics = new Set<string>();
  #unsubscribedTopics = new Set<string>();
  constructor(opts: {
    url: string;
    tokenProvider: (channel: string) => Promise<string>;
    channel: string;
    heartbeatMs?: number;
    onMessage: OnMessage;
    log?: Logger;
    autoReconnect?: boolean;
    debugHexDump?: boolean; // enable very expensive hex-dump logging
  }) {
    this.#connectionId = `conn_${Math.random().toString(36).substring(2, 8)}`;
    logger.info(`[${this.#connectionId}] PubSubConnection constructor called`, {
      url: opts.url,
      heartbeatMs: opts.heartbeatMs ?? 25_000,
    });

    if (!validateWebSocketUrl(opts.url)) {
      logger.error(`[${this.#connectionId}] Invalid WebSocket URL`, {
        url: opts.url,
      });
      throw new Error("Invalid WebSocket URL");
    }

    this.#url = opts.url;
    this.#channel = opts.channel;
    this.#getToken = async (channel: string) => {
      logger.info(`[${this.#connectionId}] Getting token from provider`, {
        channel,
      });
      try {
        const token = await opts.tokenProvider(channel);
        if (!token) {
          logger.error(
            `[${this.#connectionId}] No token provided by token provider`,
          );
          throw new Error("No token provided");
        }
        logger.info(`[${this.#connectionId}] Token received`, {
          tokenPreview: logSensitiveData(token, "token"),
          channel,
        });
        return token;
      } catch (error) {
        logger.error(
          `[${this.#connectionId}] Error getting token from provider`,
          { error, channel },
        );
        throw error;
      }
    };
    this.#hbMs = opts.heartbeatMs ?? 25_000;
    this.#onMsg = opts.onMessage;
    this.#log = opts.log ?? (() => {});
    this.#autoReconnect = opts.autoReconnect ?? false;
    this.#debugHexDump = opts.debugHexDump ?? false;
    logger.info(`[${this.#connectionId}] PubSubConnection initialized`, {
      url: this.#url,
      heartbeatMs: this.#hbMs,
    });
  }

  // --- grant cache helpers (browser-safe) ---
  #getCachedGrant(): string | undefined {
    logger.info(`[${this.#connectionId}] Attempting to get cached grant`);
    try {
      // Only in browser environments
      if (typeof localStorage !== "undefined") {
        const v = localStorage.getItem(GRANT_CACHE_KEY);
        if (v) {
          logger.info(`[${this.#connectionId}] Cached grant found`, {
            grantPreview: logSensitiveData(v, "cached_grant"),
          });
        } else {
          logger.info(`[${this.#connectionId}] No cached grant found`);
        }
        return v ?? undefined;
      } else {
        logger.info(
          `[${this.#connectionId}] localStorage not available (non-browser environment)`,
        );
      }
    } catch (error) {
      logger.warn(`[${this.#connectionId}] Error accessing cached grant`, {
        error,
      });
      // ignore storage access errors (Safari ITP, quota, etc.)
    }
    return undefined;
  }

  #setCachedGrant(token: string) {
    logger.info(`[${this.#connectionId}] Setting cached grant`, {
      grantPreview: logSensitiveData(token, "grant_to_cache"),
    });
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(GRANT_CACHE_KEY, token);
        logger.info(`[${this.#connectionId}] Grant cached successfully`);
      } else {
        logger.info(
          `[${this.#connectionId}] Cannot cache grant - localStorage not available`,
        );
      }
    } catch (error) {
      logger.warn(`[${this.#connectionId}] Error caching grant`, { error });
      // ignore
    }
  }

  #clearCachedGrant() {
    logger.info(`[${this.#connectionId}] Clearing cached grant`);
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(GRANT_CACHE_KEY);
        logger.info(
          `[${this.#connectionId}] Cached grant cleared successfully`,
        );
      } else {
        logger.info(
          `[${this.#connectionId}] Cannot clear grant - localStorage not available`,
        );
      }
    } catch (error) {
      logger.warn(`[${this.#connectionId}] Error clearing cached grant`, {
        error,
      });
      // ignore
    }
  }

  async open(timeout?: number) {
    logger.info(`[${this.#connectionId}] Connection.open called`, { timeout });
    this.#log("info", "connection.open called");

    // Prevent multiple simultaneous connection attempts
    if (this.#state === "connecting" || this.#state === "open") {
      logger.info(
        `[${this.#connectionId}] Connection already ${this.#state}, returning early`,
      );
      return;
    }

    // Validate that channel is set before connecting
    if (!this.#channel || this.#channel.trim().length === 0) {
      const error = "Channel must be set before opening connection";
      logger.error(`[${this.#connectionId}] ${error}`, {
        channel: this.#channel,
      });
      throw new Error(error);
    }

    // Prefer cached grant; if missing, ask provider and cache it
    let grantJWT = this.#getCachedGrant();
    if (!grantJWT) {
      logger.info(
        `[${this.#connectionId}] No cached grant, requesting fresh token`,
        { channel: this.#channel },
      );
      const fresh = await this.#getToken(this.#channel);
      grantJWT = fresh;
      if (grantJWT) {
        logger.info(`[${this.#connectionId}] Fresh token received, caching it`);
        this.#setCachedGrant(grantJWT);
      }
    } else {
      logger.info(`[${this.#connectionId}] Using cached grant`, {
        channel: this.#channel,
      });
    }

    logger.info(`[${this.#connectionId}] Setting state to connecting`);
    this.#state = "connecting";

    const connectUrl = new URL(this.#url);

    logger.info(`[${this.#connectionId}] Creating WebSocket connection`, {
      url: this.#url,
      grantPreview: logSensitiveData(grantJWT, "grant"),
    });

    // The WebSocket constructor in browsers does not support headers option.
    // Instead, append the grant as a query parameter.
    connectUrl.searchParams.set("grant", grantJWT);
    const ws = new WebSocket(connectUrl.toString());
    try {
      // Ensure we receive ArrayBuffer rather than Blob in browsers/JSDOM
      (ws as any).binaryType = "arraybuffer";
    } catch {}
    this.#ws = ws;

    ws.addEventListener(
      "open",
      async () => {
        try {
          logger.info(`[${this.#connectionId}] WebSocket opened successfully`);
          // 1) send connect packet
          this.#log("info", "ws open; sending connect packet");
          logger.info(`[${this.#connectionId}] Sending connect packet`, {
            grantPreview: logSensitiveData(grantJWT, "connect_grant"),
          });
          this.send({ packetType: "connect", grantJWT });

          // 2) mark open, start heartbeat, resubscribe
          this.#retry = 0;
          this.#state = "open";
          logger.info(
            `[${this.#connectionId}] Connection state set to open, starting heartbeat`,
          );
          this.#startHeartbeat();

          if (this.#subs.size > 0) {
            logger.info(`[${this.#connectionId}] Resubscribing to topics`, {
              topicCount: this.#subs.size,
              topics: Array.from(this.#subs),
            });
          }

          for (const t of this.#subs) {
            this.#log("info", "resubscribing", { topic: t });
            logger.info(`[${this.#connectionId}] Resubscribing to topic`, {
              topic: t,
            });
            try {
              this.send({ packetType: "subscribe", topic: t });
            } catch (error) {
              logger.error(
                `[${this.#connectionId}] Error resubscribing to topic`,
                { error, topic: t },
              );
              // Continue with other topics even if one fails
            }
          }
        } catch (error) {
          logger.error(
            `[${this.#connectionId}] Error during connection setup`,
            { error },
          );
          // If setup fails, close the connection
          try {
            ws.close();
          } catch (closeError) {
            logger.error(
              `[${this.#connectionId}] Error closing connection after setup failure`,
              { closeError },
            );
          }
        }
      },
      { once: true },
    );

    ws.addEventListener("message", async (ev) => {
      this.#log("info", "ws message received");
      // Print the hex of the message (guarded; very expensive)
      if (this.#debugHexDump) {
        const hex =
          typeof ev.data === "string"
            ? Buffer.from(ev.data, "utf8").toString("hex")
            : ev.data instanceof ArrayBuffer
              ? Buffer.from(ev.data).toString("hex")
              : typeof ev.data === "object" && (ev.data as any)?.arrayBuffer
                ? Buffer.from(
                    new Uint8Array(await (ev.data as any).arrayBuffer()),
                  ).toString("hex")
                : "";
        console.log(`[${this.#connectionId}] WS message hex:`, hex);
      }

      // Log the type of ev.data before conversion
      logger.info(
        `[${this.#connectionId}] WebSocket message raw data received`,
        {
          dataType: typeof ev.data,
          isNull: ev.data === null,
          isUndefined: typeof ev.data === "undefined",
        },
      );

      let dataStr: string;

      try {
        if (typeof ev.data === "string") {
          logger.info(`[${this.#connectionId}] ev.data is already a string`, {
            length: ev.data.length,
          });
          dataStr = ev.data;
        } else if (typeof ev.data === "undefined" || ev.data === null) {
          logger.warn(
            `[${this.#connectionId}] ev.data is undefined or null, using empty string`,
          );
          dataStr = "";
        } else if (
          ev.data &&
          typeof (ev.data as any).arrayBuffer === "function"
        ) {
          // Blob-like (supports arrayBuffer())
          logger.info(`[${this.#connectionId}] Processing Blob-like message`);
          const arrayBuffer = await (ev.data as any).arrayBuffer();
          const uint8 = new Uint8Array(arrayBuffer);
          if (this.#debugHexDump) {
            const hex = Array.from(uint8)
              .map((b) => b.toString(16).padStart(2, "0"))
              .join("");
            console.log(
              `[${this.#connectionId}] WS Blob-like message hex:`,
              hex,
            );
          }
          dataStr = new TextDecoder().decode(uint8);
          logger.info(`[${this.#connectionId}] Blob-like converted to string`, {
            dataStr: dataStr.slice(0, 100),
            hexPreview: this.#debugHexDump ? "enabled" : "disabled",
          });
        } else if (typeof Buffer !== "undefined" && Buffer.isBuffer(ev.data)) {
          // Node Buffer
          const buf: Buffer = ev.data as any;
          const uint8 = new Uint8Array(
            buf.buffer,
            buf.byteOffset,
            buf.byteLength,
          );
          dataStr = new TextDecoder().decode(uint8);
          logger.info(`[${this.#connectionId}] Buffer converted to string`, {
            dataStr: dataStr.slice(0, 100),
          });
        } else if (ev.data instanceof ArrayBuffer) {
          const uint8 = new Uint8Array(ev.data as ArrayBuffer);
          dataStr = new TextDecoder().decode(uint8);
          logger.info(
            `[${this.#connectionId}] ArrayBuffer converted to string`,
            {
              dataStr: dataStr.slice(0, 100),
            },
          );
        } else if (ev.data instanceof Uint8Array) {
          dataStr = new TextDecoder().decode(ev.data as Uint8Array);
          logger.info(
            `[${this.#connectionId}] Uint8Array converted to string`,
            {
              dataStr: dataStr.slice(0, 100),
            },
          );
        } else {
          logger.info(`[${this.#connectionId}] Converting ev.data to string`, {
            originalType: typeof ev.data,
            valuePreview: String(ev.data).slice(0, 100),
          });
          dataStr = String(ev.data);
        }
      } catch (error) {
        logger.error(`[${this.#connectionId}] Error processing message data`, {
          error,
          dataType: typeof ev.data,
        });
        return;
      }

      logger.info(
        `[${this.#connectionId}] WebSocket message received (post-conversion)`,
        {
          dataLength: dataStr.length,
        },
      );

      if (dataStr.length === 0) {
        logger.warn(`[${this.#connectionId}] Data string is empty, skipping`);
        return;
      }

      const parsed = parseServerFrame(dataStr);
      if (!parsed) {
        logger.warn(`[${this.#connectionId}] Failed to parse server frame`, {
          rawDataPreview: dataStr.slice(0, 200),
        });
        return;
      }
      logger.info(`[${this.#connectionId}] Parsed message`, {
        topic: parsed.topic,
        messageId: parsed.id || "unknown",
      });

      try {
        this.#onMsg({
          packetType: "publish",
          topic: parsed.topic,
          payload: parsed,
        });
      } catch (error) {
        logger.error(`[${this.#connectionId}] Error in message handler`, {
          error,
          topic: parsed.topic,
          messageId: parsed.id,
        });
        // Don't rethrow - we want to keep the connection alive even if handlers fail
      }
    });

    ws.addEventListener("close", () => {
      this.#log("warn", "ws close encountered", { retry: this.#retry });
      logger.warn(`[${this.#connectionId}] WebSocket close encountered`, {
        retry: this.#retry,
        state: this.#state,
      });

      // Only attempt reconnect if we're not already closed and auto-reconnect is enabled
      if (this.#state !== "closed" && this.#autoReconnect) {
        if (this.#retry >= 1) {
          logger.info(
            `[${this.#connectionId}] Retry limit reached, clearing cached grant`,
          );
          this.#clearCachedGrant();
          this.#retry = 0; // treat next attempt as a fresh start
        }
        this.#reconnect();
      } else {
        // Mark as closed if not auto-reconnecting
        this.#state = "closed";
        this.#stopHeartbeat();
      }
    });

    ws.addEventListener("error", (e) => {
      this.#log("warn", "ws error", e);
      logger.warn(`[${this.#connectionId}] WebSocket error`, {
        error: e,
        state: this.#state,
        readyState: ws.readyState,
        url: this.#url,
      });

      // Log additional error details if available
      if (e instanceof ErrorEvent) {
        logger.error(`[${this.#connectionId}] WebSocket ErrorEvent details`, {
          message: e.message,
          filename: e.filename,
          lineno: e.lineno,
          colno: e.colno,
          error: e.error,
        });
      }
    });

    if (timeout) {
      logger.info(`[${this.#connectionId}] Setting connection timeout`, {
        timeout,
      });
      const timeoutId = setTimeout(() => {
        logger.error(`[${this.#connectionId}] Connection timeout reached`, {
          timeout,
        });
        ws.close();
        throw new Error("Connection timeout");
      }, timeout);
      await new Promise<void>((res) =>
        ws.addEventListener(
          "open",
          () => {
            logger.info(
              `[${this.#connectionId}] Connection opened within timeout, clearing timeout`,
            );
            clearTimeout(timeoutId);
            res();
          },
          { once: true },
        ),
      );
    } else {
      logger.info(
        `[${this.#connectionId}] Waiting for connection to open (no timeout)`,
      );
      await new Promise<void>((res) =>
        ws.addEventListener(
          "open",
          () => {
            logger.info(
              `[${this.#connectionId}] Connection opened successfully`,
            );
            res();
          },
          { once: true },
        ),
      );
    }
  }

  subscribe(topic: string) {
    logger.info(`[${this.#connectionId}] Subscribe called`, { topic });
    this.#log("info", "subscribe called", { topic });

    // Validate topic
    if (!topic || typeof topic !== "string" || topic.trim().length === 0) {
      const error = "Invalid topic: must be a non-empty string";
      logger.error(`[${this.#connectionId}] ${error}`, { topic });
      throw new Error(error);
    }

    // Optimistically mark as subscribed
    this.#subscribedTopics.add(topic);
    this.#unsubscribedTopics.delete(topic); // Remove from unsubscribed if it was there

    this.#subs.add(topic);
    logger.info(`[${this.#connectionId}] Topic added to subscriptions`, {
      topic,
      totalSubs: this.#subs.size,
    });
    if (this.#state === "open") {
      logger.info(
        `[${this.#connectionId}] Connection open, sending subscribe packet`,
        { topic },
      );
      try {
        this.send({ packetType: "subscribe", topic });
      } catch (error) {
        logger.error(`[${this.#connectionId}] Error sending subscribe packet`, {
          error,
          topic,
        });
        // Remove from subscriptions if sending fails
        this.#subs.delete(topic);
        this.#subscribedTopics.delete(topic); // Revert optimistic update
        throw error;
      }
    } else {
      logger.info(
        `[${this.#connectionId}] Connection not open, subscription will be sent when connected`,
        { topic },
      );
    }
  }

  unsubscribe(topic: string) {
    logger.info(`[${this.#connectionId}] Unsubscribe called`, { topic });
    this.#log("info", "unsubscribe called", { topic });

    // Validate topic
    if (!topic || typeof topic !== "string" || topic.trim().length === 0) {
      const error = "Invalid topic: must be a non-empty string";
      logger.error(`[${this.#connectionId}] ${error}`, { topic });
      throw new Error(error);
    }

    // Optimistically mark as unsubscribed
    this.#unsubscribedTopics.add(topic);
    this.#subscribedTopics.delete(topic); // Remove from subscribed

    this.#subs.delete(topic);
    logger.info(`[${this.#connectionId}] Topic removed from subscriptions`, {
      topic,
      totalSubs: this.#subs.size,
    });
    if (this.#state === "open") {
      logger.info(
        `[${this.#connectionId}] Connection open, sending unsubscribe packet`,
        { topic },
      );
      try {
        this.send({ packetType: "unsubscribe", topic });
      } catch (error) {
        logger.error(
          `[${this.#connectionId}] Error sending unsubscribe packet`,
          { error, topic },
        );
        // Don't rethrow - we've already removed from subscriptions
        // But we could revert the optimistic update if needed
      }
    } else {
      logger.info(
        `[${this.#connectionId}] Connection not open, unsubscription will be sent when connected`,
        { topic },
      );
    }
  }

  publish(payload: MessageBody) {
    logger.info(`[${this.#connectionId}] Publish called`, {
      topic: (payload as any).topic,
      payloadType: typeof payload,
    });

    // Validate payload
    if (!payload || typeof payload !== "object") {
      const error = "Invalid payload: must be an object";
      logger.error(`[${this.#connectionId}] ${error}`, { payload });
      throw new Error(error);
    }

    if (!this.#ws || this.#state !== "open") {
      logger.error(`[${this.#connectionId}] Cannot publish - not connected`, {
        hasWs: !!this.#ws,
        state: this.#state,
      });
      throw new NotConnectedError("Not connected");
    }

    // Enhanced backpressure monitoring with multiple thresholds
    const bufferedAmount = this.#ws.bufferedAmount;

    // Log buffered amount for latency analysis
    if (bufferedAmount > 0) {
      logger.info(`[${this.#connectionId}] WebSocket buffer contains data`, {
        bufferedAmount,
        topic: payload.topic,
      });
    }

    // Multiple backpressure thresholds for better latency control
    if (bufferedAmount > 1_000_000) {
      logger.error(
        `[${this.#connectionId}] Critical backpressure - closing connection`,
        {
          buffered: bufferedAmount,
          limit: 1_000_000,
        },
      );
      this.#log("error", "critical backpressure; reconnecting", {
        buffered: bufferedAmount,
      });
      this.#ws.close();
      throw new BackpressureError("Critical backpressure");
    } else if (bufferedAmount > 100_000) {
      logger.warn(`[${this.#connectionId}] High backpressure detected`, {
        buffered: bufferedAmount,
        warningThreshold: 100_000,
      });
      this.#log("warn", "high backpressure warning", {
        buffered: bufferedAmount,
      });
    } else if (bufferedAmount > 10_000) {
      logger.info(`[${this.#connectionId}] Moderate buffering detected`, {
        buffered: bufferedAmount,
        infoThreshold: 10_000,
      });
    }

    this.#log("info", "publish sending", { topic: (payload as any).topic });
    // Ensure client correlation fields exist (best-effort)
    try {
      if (!payload.clientPublishTs) {
        (payload as any).clientPublishTs = Date.now();
      }
      if (!payload.clientMsgId) {
        if (
          typeof crypto !== "undefined" &&
          typeof crypto.randomUUID === "function"
        ) {
          (payload as any).clientMsgId = crypto.randomUUID();
        }
      }
    } catch (_) {
      // ignore failures to set optional client fields
    }
    logger.info(`[${this.#connectionId}] Publishing message`, {
      topic: (payload as any).topic,
      bufferedAmount: this.#ws.bufferedAmount,
    });
    consola.info(
      `[PubSubConnection] [${this.#connectionId}] Publishing message`,
      {
        topic: payload.topic,
        bufferedAmount: this.#ws.bufferedAmount,
      },
    );

    try {
      this.send({
        packetType: "publish",
        topic: payload.topic,
        payload,
      });
    } catch (error) {
      logger.error(`[${this.#connectionId}] Error publishing message`, {
        error,
        topic: payload.topic,
      });
      throw error;
    }
  }

  setChannel(channel: string) {
    logger.info(`[${this.#connectionId}] Setting channel`, { channel });

    // Validate channel
    if (
      !channel ||
      typeof channel !== "string" ||
      channel.trim().length === 0
    ) {
      const error = "Invalid channel: must be a non-empty string";
      logger.error(`[${this.#connectionId}] ${error}`, { channel });
      throw new Error(error);
    }

    this.#channel = channel;
    // Clear cached grant when channel changes to force fresh token
    this.#clearCachedGrant();
    logger.info(`[${this.#connectionId}] Channel set successfully`, {
      channel: this.#channel,
    });
  }

  close() {
    logger.info(
      `[${this.#connectionId}] Connection.close called (url: ${this.#url})`,
    );
    this.#log("info", `connection.close called (url: ${this.#url})`);

    // Prevent further operations
    this.#state = "closed";
    logger.info(
      `[${this.#connectionId}] Connection state set to closed (url: ${this.#url})`,
    );

    // Stop heartbeat first
    this.#stopHeartbeat();

    // Clear any pending timeouts and close WebSocket
    if (this.#ws) {
      try {
        // Only close if not already closed
        if (
          this.#ws.readyState === WebSocket.OPEN ||
          this.#ws.readyState === WebSocket.CONNECTING
        ) {
          this.#ws.close();
        }
      } catch (error) {
        logger.warn(`[${this.#connectionId}] Error closing WebSocket`, {
          error,
        });
      }
      this.#ws = undefined;
    }

    // Clear subscriptions
    this.#subs.clear();

    // Clear cached grant on close
    this.#clearCachedGrant();

    logger.info(`[${this.#connectionId}] Connection closed and cleaned up`);
  }

  // --- internals ---

  private send(pkt: PacketEnvelope) {
    logger.info(`[${this.#connectionId}] Sending packet`, {
      packetType: pkt.packetType,
    });

    // Validate packet
    if (!pkt || typeof pkt !== "object") {
      const error = "Invalid packet: must be an object";
      logger.error(`[${this.#connectionId}] ${error}`, { pkt });
      throw new Error(error);
    }

    if (!this.#ws || this.#ws.readyState !== WebSocket.OPEN) {
      logger.error(
        `[${this.#connectionId}] Cannot send packet - WebSocket not ready`,
        {
          hasWs: !!this.#ws,
          readyState: this.#ws?.readyState,
          state: this.#state,
        },
      );
      throw new NotConnectedError(
        "Not connected readyState: " + this.#ws?.readyState,
      );
    }

    try {
      const encoded = encodeEnvelope(pkt);
      logger.info(
        `[PubSubConnection] [${this.#connectionId}] Packet encoded, sending via WebSocket`,
        {
          packetType: pkt.packetType,
          encodedLength: encoded.length,
        },
      );
      this.#ws.send(encoded);
    } catch (error) {
      logger.error(`[${this.#connectionId}] Error sending packet`, {
        error,
        packetType: pkt.packetType,
      });
      throw error;
    }
  }

  #reconnect() {
    if (this.#state === "closed" || this.#state === "connecting") {
      logger.info(
        `[${this.#connectionId}] Reconnect called but connection is ${this.#state}, ignoring`,
      );
      return;
    }

    logger.info(`[${this.#connectionId}] Starting reconnect process`);
    this.#stopHeartbeat();
    this.#state = "idle"; // Reset to idle to allow reconnection

    const bckOff = backoff(this.#retry, 5000);

    this.#log("info", "scheduling reconnect", { retry: this.#retry, bckOff });
    logger.info(`[${this.#connectionId}] Scheduling reconnect`, {
      retry: this.#retry,
      backoff,
      maxBackoff: 5000,
      baseBackoff: 250 * Math.pow(2, this.#retry),
    });
    this.#retry++;
    setTimeout(() => {
      logger.info(`[${this.#connectionId}] Executing scheduled reconnect`);
      this.open().catch((error) => {
        logger.error(`[${this.#connectionId}] Reconnect failed`, { error });
        // If reconnect fails, mark as closed to prevent further attempts
        this.#state = "closed";
      });
    }, bckOff);
  }

  #startHeartbeat() {
    logger.info(`[${this.#connectionId}] Starting heartbeat`, {
      intervalMs: this.#hbMs,
    });
    this.#stopHeartbeat();
    this.#hb = setInterval(() => {
      if (!this.#ws || this.#state !== "open") {
        logger.debug(
          `[${this.#connectionId}] Skipping heartbeat - connection not ready`,
          {
            hasWs: !!this.#ws,
            state: this.#state,
            readyState: this.#ws?.readyState,
          },
        );
        return;
      }

      try {
        /**
         * Heartbeats are just a ping string, not a packet envelope
         * it gets an auto response `pong` from the cloudflare gateway if it's still alive
         */
        this.#log("info", "sending heartbeat ping");
        logger.info(`[${this.#connectionId}] Sending heartbeat ping`);
        this.#ws.send("ping");
      } catch (error) {
        logger.error(`[${this.#connectionId}] Error sending heartbeat`, {
          error,
        });
        // If heartbeat fails, close the connection to trigger reconnect
        try {
          this.#ws.close();
        } catch (closeError) {
          logger.error(
            `[${this.#connectionId}] Error closing connection after heartbeat failure`,
            { closeError },
          );
        }
      }
    }, this.#hbMs);
  }

  #stopHeartbeat() {
    if (this.#hb) {
      logger.info(`[${this.#connectionId}] Stopping heartbeat`);
      clearInterval(this.#hb);
      this.#hb = undefined;
    } else {
      logger.debug(`[${this.#connectionId}] No heartbeat to stop`);
    }
  }

  /**
   * * Development-only state getter
   * @returns The current state of the connection
   */
  get __debugState(): string {
    return this.#state;
  }

  /**
   * Get the current connection state
   */
  get state(): string {
    return this.#state;
  }

  /**
   * Check if the connection is currently open and ready
   */
  get isConnected(): boolean {
    return this.#state === "open";
  }

  /**
   * Check if the connection is currently connecting
   */
  get isConnecting(): boolean {
    return this.#state === "connecting";
  }

  /**
   * Check if the connection is currently closed
   */
  get isClosed(): boolean {
    return this.#state === "closed";
  }

  /**
   * Check if the connection is in idle state
   */
  get isIdle(): boolean {
    return this.#state === "idle";
  }

  /**
   * Check if the connection is readable (can receive messages)
   */
  get isReadable(): boolean {
    return this.#state === "open";
  }

  /**
   * Check if the connection is writable (can send messages)
   */
  get isWritable(): boolean {
    return this.#state === "open";
  }

  /**
   * Get the current channel name
   */
  get channel(): string {
    return this.#channel;
  }

  /**
   * Get the number of active subscriptions
   */
  get subscriptionCount(): number {
    return this.#subs.size;
  }

  /**
   * Get the list of active subscriptions
   */
  get subscriptions(): string[] {
    return Array.from(this.#subs);
  }

  /**
   * Get the WebSocket ready state
   */
  get readyState(): number | undefined {
    return this.#ws?.readyState;
  }

  /**
   * Get the current buffered amount
   */
  get bufferedAmount(): number {
    return this.#ws?.bufferedAmount ?? 0;
  }

  /**
   * Get the connection ID
   */
  get connectionId(): string {
    return this.#connectionId;
  }

  /**
   * Get the connection URL
   */
  get url(): string {
    return this.#url;
  }

  /**
   * Get connection health information
   */
  get connectionHealth(): {
    state: string;
    isConnected: boolean;
    isReadable: boolean;
    isWritable: boolean;
    channel: string;
    subscriptionCount: number;
    readyState: number | undefined;
    bufferedAmount: number;
    connectionId: string;
    url: string;
  } {
    return {
      state: this.state,
      isConnected: this.isConnected,
      isReadable: this.isReadable,
      isWritable: this.isWritable,
      channel: this.channel,
      subscriptionCount: this.subscriptionCount,
      readyState: this.readyState,
      bufferedAmount: this.bufferedAmount,
      connectionId: this.connectionId,
      url: this.url,
    };
  }

  /**
   * Check if a topic is currently subscribed
   */
  isSubscribed(topic: string): boolean {
    return (
      this.#subscribedTopics.has(topic) && !this.#unsubscribedTopics.has(topic)
    );
  }

  /**
   * Get subscription status for a topic
   */
  getSubscriptionStatus(
    topic: string,
  ): "subscribed" | "unsubscribed" | "pending" {
    if (
      this.#subscribedTopics.has(topic) &&
      !this.#unsubscribedTopics.has(topic)
    ) {
      return "subscribed";
    } else if (this.#unsubscribedTopics.has(topic)) {
      return "unsubscribed";
    } else {
      return "pending";
    }
  }

  /**
   * Get all subscribed topics
   */
  get subscribedTopics(): string[] {
    return Array.from(this.#subscribedTopics).filter(
      (topic) => !this.#unsubscribedTopics.has(topic),
    );
  }

  /**
   * Get all unsubscribed topics
   */
  get unsubscribedTopics(): string[] {
    return Array.from(this.#unsubscribedTopics);
  }

  /**
   * Get subscription tracking information
   */
  get subscriptionTracking(): {
    subscribed: string[];
    unsubscribed: string[];
    pending: string[];
  } {
    const pending = Array.from(this.#subs).filter(
      (topic) =>
        !this.#subscribedTopics.has(topic) &&
        !this.#unsubscribedTopics.has(topic),
    );

    return {
      subscribed: this.subscribedTopics,
      unsubscribed: this.unsubscribedTopics,
      pending,
    };
  }

  /**
   * * Development-only state getter
   * @returns The current state of the connection
   */
  get __debugObject(): {
    url: string;
    state: string;
    subs: string[];
    bufferedAmount: number;
    connectionId: string;
  } {
    return {
      url: this.#url,
      state: this.#state,
      subs: Array.from(this.#subs),
      bufferedAmount: this.#ws?.bufferedAmount ?? 0,
      connectionId: this.#connectionId,
    };
  }
}
