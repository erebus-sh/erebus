import type { PacketEnvelope } from "@repo/schemas/packetEnvelope";
import type {
  IConnectionManager,
  ConnectionState,
  ConnectionConfig,
  OnMessage,
  Logger,
  OpenOptions,
} from "./interfaces";
import { encodeEnvelope } from "@/client/core/wire";
import { logger } from "@/internal/logger/consola";
import { validateWebSocketUrl } from "@/internal/validateWebSocketUrl";
import { backoff } from "../backoff";
import { WsErrors } from "@repo/shared/enums/wserrors";
import { ErebusError } from "@/internal/error";
import { VERSION } from "../types";

export class BackpressureError extends Error {}
export class NotConnectedError extends Error {}

/**
 * Manages WebSocket connection lifecycle and basic communication
 */
export class ConnectionManager implements IConnectionManager {
  #url: string;
  #channel: string;
  #ws?: WebSocket;
  #retry = 0;
  #state: ConnectionState = "idle";
  #connectionId: string;
  #grant: string;
  #autoReconnect: boolean;
  #onMessage: OnMessage;
  #log: Logger;
  #debugHexDump: boolean;

  constructor(config: ConnectionConfig) {
    this.#connectionId = `conn_${Math.random().toString(36).substring(2, 8)}`;
    logger.info(`[${this.#connectionId}] ConnectionManager created`, {
      url: config.url,
    });

    if (!validateWebSocketUrl(config.url)) {
      logger.error(`[${this.#connectionId}] Invalid WebSocket URL`, {
        url: config.url,
      });
      throw new Error("Invalid WebSocket URL");
    }

    this.#url = config.url;
    this.#channel = config.channel;
    this.#grant = ""; // Initialize empty, will be set when opening
    this.#onMessage = config.onMessage;
    this.#log = config.log ?? (() => {});
    this.#autoReconnect = config.autoReconnect ?? false;
    this.#debugHexDump = config.debugHexDump ?? false;
  }

  // Getters
  get state(): ConnectionState {
    return this.#state;
  }

  get isConnected(): boolean {
    return this.#state === "open";
  }

  get isConnecting(): boolean {
    return this.#state === "connecting";
  }

  get isClosed(): boolean {
    return this.#state === "closed";
  }

  get isIdle(): boolean {
    return this.#state === "idle";
  }

  get connectionId(): string {
    return this.#connectionId;
  }

  get url(): string {
    return this.#url;
  }

  get bufferedAmount(): number {
    return this.#ws?.bufferedAmount ?? 0;
  }

  get readyState(): number | undefined {
    return this.#ws?.readyState;
  }

  get channel(): string {
    return this.#channel;
  }

  async open(options: OpenOptions): Promise<void> {
    logger.info(`[${this.#connectionId}] Opening connection`, {
      timeout: options.timeout,
    });
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

    logger.info(`[${this.#connectionId}] Setting state to connecting`);
    this.#state = "connecting";

    // Store the grant for potential reconnections
    this.#grant = options.grant;

    const ws = await this.#createWebSocket(options.grant);
    this.#ws = ws;
    this.#setupWebSocketListeners(ws);

    if (options.timeout) {
      logger.info(`[${this.#connectionId}] Setting connection timeout`, {
        timeout: options.timeout,
      });
      const timeoutId = setTimeout(() => {
        logger.error(`[${this.#connectionId}] Connection timeout reached`, {
          timeout: options.timeout,
        });
        ws.close();
        throw new Error("Connection timeout");
      }, options.timeout);

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

  close(): void {
    logger.info(
      `[${this.#connectionId}] Connection close called (url: ${this.#url})`,
    );
    this.#log("info", `connection close called (url: ${this.#url})`);

    // Prevent further operations
    this.#state = "closed";
    logger.info(
      `[${this.#connectionId}] Connection state set to closed (url: ${this.#url})`,
    );

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

    logger.info(`[${this.#connectionId}] Connection closed and cleaned up`);
  }

  send(pkt: PacketEnvelope): void {
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

    // Enhanced backpressure monitoring
    const bufferedAmount = this.#ws.bufferedAmount;
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
    }

    try {
      const encoded = encodeEnvelope(pkt);
      logger.info(
        `[ConnectionManager] [${this.#connectionId}] Packet encoded, sending via WebSocket`,
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

  /**
   * Send raw string data directly through WebSocket (for heartbeats, etc.)
   */
  sendRaw(data: string): void {
    logger.info(`[${this.#connectionId}] Sending raw data`, {
      dataType: typeof data,
      dataLength: data.length,
    });

    if (!this.#ws || this.#ws.readyState !== WebSocket.OPEN) {
      logger.error(
        `[${this.#connectionId}] Cannot send raw data - WebSocket not ready`,
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
      this.#ws.send(data);
      logger.info(`[${this.#connectionId}] Raw data sent successfully`);
    } catch (error) {
      logger.error(`[${this.#connectionId}] Error sending raw data`, {
        error,
        dataLength: data.length,
      });
      throw error;
    }
  }

  setChannel(channel: string): void {
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
    logger.info(`[${this.#connectionId}] Channel set successfully`, {
      channel: this.#channel,
    });
  }

  async #createWebSocket(grant: string): Promise<WebSocket> {
    const connectUrl = new URL(this.#url);
    connectUrl.searchParams.set("grant", grant);
    logger.info(`[${this.#connectionId}] Creating WebSocket connection`, {
      url: this.#url,
      grant: grant.substring(0, 10) + "...", // Log partial grant for debugging
    });

    const ws = new WebSocket(connectUrl.toString());

    try {
      // Ensure we receive ArrayBuffer rather than Blob in browsers/JSDOM
      if ("binaryType" in ws) {
        (ws as WebSocket & { binaryType: string }).binaryType = "arraybuffer";
      }
    } catch {}

    return ws;
  }

  #setupWebSocketListeners(ws: WebSocket): void {
    ws.addEventListener(
      "open",
      () => {
        logger.info(`[${this.#connectionId}] WebSocket opened successfully`);
        this.#retry = 0;
        this.#state = "open";
        this.#log("info", "ws open");
      },
      { once: true },
    );

    ws.addEventListener("message", (ev) => {
      this.#handleMessage(ev);
    });

    ws.addEventListener("close", (event: CloseEvent) => {
      this.#log("warn", "ws close encountered", { retry: this.#retry });
      logger.warn(`[${this.#connectionId}] WebSocket close encountered`, {
        retry: this.#retry,
        state: this.#state,
      });

      if (event.code === WsErrors.VersionMismatch) {
        throw new ErebusError(
          `Version mismatch: ${event.reason} current client version: ${VERSION}`,
        );
      }

      // Only attempt reconnect if we're not already closed and auto-reconnect is enabled
      if (this.#state !== "closed" && this.#autoReconnect) {
        this.#reconnect();
      } else {
        // Mark as closed if not auto-reconnecting
        this.#state = "closed";
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
    });
  }

  async #handleMessage(ev: MessageEvent): Promise<void> {
    this.#log("info", "ws message received");

    // Handle hex dump debugging
    if (this.#debugHexDump) {
      const hex = this.#getHexDump(ev.data);
      console.log(`[${this.#connectionId}] WS message hex:`, hex);
    }

    try {
      const dataStr = await this.#convertToString(ev.data);
      if (dataStr.length === 0) {
        logger.warn(`[${this.#connectionId}] Data string is empty, skipping`);
        return;
      }

      // Forward to message processor via callback
      this.#onMessage({ rawData: dataStr } as PacketEnvelope & {
        rawData: string;
      });
    } catch (error) {
      logger.error(`[${this.#connectionId}] Error handling message`, {
        error,
      });
    }
  }

  #getHexDump(data: unknown): string {
    if (typeof data === "string") {
      return Buffer.from(data, "utf8").toString("hex");
    } else if (data instanceof ArrayBuffer) {
      return Buffer.from(data).toString("hex");
    } else if (typeof data === "object" && data && "arrayBuffer" in data) {
      // This is async, but for debug we'll return a placeholder
      return "[blob-data]";
    }
    return "";
  }

  async #convertToString(data: unknown): Promise<string> {
    if (typeof data === "string") {
      return data;
    } else if (typeof data === "undefined" || data === null) {
      logger.warn(
        `[${this.#connectionId}] Data is undefined or null, using empty string`,
      );
      return "";
    } else if (
      data &&
      typeof data === "object" &&
      "arrayBuffer" in data &&
      typeof (data as { arrayBuffer: () => Promise<ArrayBuffer> })
        .arrayBuffer === "function"
    ) {
      // Blob-like (supports arrayBuffer())
      const arrayBuffer = await (
        data as { arrayBuffer: () => Promise<ArrayBuffer> }
      ).arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);
      return new TextDecoder().decode(uint8);
    } else if (typeof Buffer !== "undefined" && Buffer.isBuffer(data)) {
      // Node Buffer
      const buf = data as Buffer;
      const uint8 = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
      return new TextDecoder().decode(uint8);
    } else if (data instanceof ArrayBuffer) {
      const uint8 = new Uint8Array(data);
      return new TextDecoder().decode(uint8);
    } else if (data instanceof Uint8Array) {
      return new TextDecoder().decode(data);
    } else {
      return String(data);
    }
  }

  #reconnect(): void {
    if (this.#state === "closed" || this.#state === "connecting") {
      logger.info(
        `[${this.#connectionId}] Reconnect called but connection is ${this.#state}, ignoring`,
      );
      return;
    }

    logger.info(`[${this.#connectionId}] Starting reconnect process`);
    this.#state = "idle"; // Reset to idle to allow reconnection

    const bckOff = backoff(this.#retry, 5000);
    this.#log("info", "scheduling reconnect", { retry: this.#retry, bckOff });
    logger.info(`[${this.#connectionId}] Scheduling reconnect`, {
      retry: this.#retry,
      backoff: bckOff,
    });

    this.#retry++;
    setTimeout(() => {
      logger.info(`[${this.#connectionId}] Executing scheduled reconnect`);
      this.open({ grant: this.#grant, timeout: 5000 }).catch((error) => {
        logger.error(`[${this.#connectionId}] Reconnect failed`, { error });
        this.#state = "closed";
      });
    }, bckOff);
  }
}
