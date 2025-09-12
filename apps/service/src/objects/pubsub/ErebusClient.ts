import { Grant, GrantSchema, Access } from "@repo/schemas/grant";
import { AckPacketType } from "@repo/schemas/packetEnvelope";

/**
 * ErebusClient - A type-safe wrapper around WebSocket connections that encapsulates
 * all client context and eliminates the need for repeated attachment parsing.
 *
 * This class provides:
 * - Type-safe access to client grant and metadata
 * - Centralized WebSocket state management
 * - Convenient methods for common operations
 * - Single source of truth for client context
 */
export class ErebusClient {
  private readonly _ws: WebSocket;
  private readonly _grant: Grant;

  /**
   * Private constructor - use static factory methods to create instances.
   *
   * @param ws - The underlying WebSocket connection
   * @param grant - Parsed and validated grant data
   */
  private constructor(ws: WebSocket, grant: Grant) {
    this._ws = ws;
    this._grant = grant;
  }

  /**
   * Create an ErebusClient from a WebSocket with an existing attachment.
   *
   * @param ws - WebSocket with grant attachment already set
   * @returns ErebusClient instance or null if attachment is invalid
   */
  static fromWebSocket(ws: WebSocket): ErebusClient | null {
    try {
      const attachment = ws.deserializeAttachment();
      if (!attachment) {
        return null;
      }

      const grantResult = GrantSchema.safeParse(attachment);
      if (!grantResult.success) {
        return null;
      }

      return new ErebusClient(ws, grantResult.data);
    } catch (error) {
      return null;
    }
  }

  /**
   * Create an ErebusClient by attaching a grant to a WebSocket.
   *
   * @param ws - Raw WebSocket connection
   * @param grant - Validated grant data to attach
   * @returns ErebusClient instance
   */
  static withGrant(ws: WebSocket, grant: Grant): ErebusClient {
    ws.serializeAttachment(grant);
    return new ErebusClient(ws, grant);
  }

  // Grant accessors
  get clientId(): string {
    return this._grant.userId;
  }

  get webhookUrl(): string {
    return this._grant.webhook_url;
  }

  get projectId(): string {
    return this._grant.project_id;
  }

  get keyId(): string {
    return this._grant.key_id;
  }

  get channel(): string {
    return this._grant.channel;
  }

  get topics(): Grant["topics"] {
    return this._grant.topics;
  }

  get grant(): Grant {
    return this._grant;
  }

  // WebSocket state accessors
  get readyState(): number {
    return this._ws.readyState;
  }

  get isOpen(): boolean {
    return this._ws.readyState === WebSocket.READY_STATE_OPEN;
  }

  get bufferedAmount(): number {
    return (this._ws as any).bufferedAmount || 0;
  }

  // WebSocket operations
  send(data: string | Uint8Array): void {
    if (this.isOpen) {
      this._ws.send(data);
    }
  }

  sendJSON(data: unknown): void {
    if (this.isOpen) {
      this._ws.send(JSON.stringify(data));
    }
  }

  sendAck(ack: AckPacketType): void {
    this.sendJSON(ack);
  }

  close(code?: number, reason?: string): void {
    try {
      if (this.isOpen) {
        this._ws.close(code, reason);
      }
    } catch (error) {
      // Ignore close errors
    }
  }

  // Access control helpers
  hasReadAccess(topic: string): boolean {
    return this._grant.topics.some(
      (t) =>
        (t.topic === topic || t.topic === "*") &&
        (t.scope === Access.Read || t.scope === Access.ReadWrite),
    );
  }

  hasWriteAccess(topic: string): boolean {
    return this._grant.topics.some(
      (t) =>
        (t.topic === topic || t.topic === "*") &&
        (t.scope === Access.Write || t.scope === Access.ReadWrite),
    );
  }

  hasHuhAccess(topic: string): boolean {
    return this._grant.topics.some(
      (t) => (t.topic === topic || t.topic === "*") && t.scope === Access.Huh,
    );
  }

  hasTopicAccess(topic: string): boolean {
    return this._grant.topics.some((t) => t.topic === topic || t.topic === "*");
  }

  // Get the raw WebSocket if needed (use sparingly)
  getRawWebSocket(): WebSocket {
    return this._ws;
  }
}
