import type { MessageBody } from "@repo/schemas/messageBody";
import type { FireWebhookSchema } from "@repo/schemas/webhooks/fireWebhook";
import type { PresencePacketType } from "@repo/schemas/packetEnvelope";
import { monoNow } from "@/lib/monotonic";
import {
  type SocketSendResult,
  type MessageMetrics,
  type BroadcastConfig,
  DEFAULT_BROADCAST_CONFIG,
  type PublishMessageParams,
  type ServiceContext,
} from "./types";
import {
  type Logger,
  createLogger,
  getErebusClients,
  enqueueUsageEvent,
} from "./service-utils";
import type { MessageBuffer } from "./MessageBuffer";
import type { ErebusClient } from "./ErebusClient";
import { generateHmac } from "@repo/shared/utils/hmac";
import { createRpcClient } from "@erebus-sh/sdk/server";

/**
 * Manages message broadcasting to WebSocket connections.
 *
 * Key design decisions for Durable Objects single-threaded actor model:
 * - Pre-serialize messages once, send to all (avoids per-client JSON.stringify)
 * - Set-based subscriber lookup for O(1) instead of O(n) array includes
 * - Background task errors logged at WARN/ERROR level (not silently swallowed)
 * - Pre-serialize both presence packet variants to avoid double serialization
 */
export class MessageBroadcaster {
  private readonly ctx: DurableObjectState;
  private readonly env: ServiceContext["env"];
  private readonly log: Logger;
  private readonly config: BroadcastConfig;
  private readonly messageBuffer: MessageBuffer;

  constructor(
    serviceContext: ServiceContext,
    messageBuffer: MessageBuffer,
    config: Partial<BroadcastConfig> = {},
  ) {
    this.ctx = serviceContext.ctx;
    this.env = serviceContext.env;
    this.log = createLogger("[MESSAGE_BROADCASTER]", serviceContext.env);
    this.config = { ...DEFAULT_BROADCAST_CONFIG, ...config };
    this.messageBuffer = messageBuffer;
  }

  /**
   * Publish a message to all subscribed WebSocket connections.
   * Pre-serializes the message once for all recipients.
   */
  async publishMessage(params: PublishMessageParams): Promise<void> {
    const {
      messageBody,
      senderClientId,
      subscriberClientIds,
      projectId,
      keyId,
      channelName,
      topic,
      seq,
      webhookUrl,
    } = params;

    const publishStartTime = monoNow();

    // Pre-serialize message body ONCE for all recipients
    const serialized = JSON.stringify(messageBody);

    // Convert to Set for O(1) lookups (was O(n) array.includes)
    const subscriberSet = new Set(subscriberClientIds);

    const clients = getErebusClients(this.ctx);
    this.log.debug(
      `[PUBLISH] topic=${topic} seq=${seq} subscribers=${subscriberSet.size} connections=${clients.length}`,
    );

    const metrics: MessageMetrics = {
      sentCount: 0,
      skippedCount: 0,
      duplicateCount: 0,
      errorCount: 0,
      highBackpressureCount: 0,
    };

    const sentToClients = new Set<string>();

    // Process clients in batches
    await this.processClientBatches(
      clients,
      serialized,
      senderClientId,
      subscriberSet,
      topic,
      sentToClients,
      metrics,
    );

    // Update timing metadata
    const tWsWriteEnd = monoNow();
    messageBody.t_ws_write_end = tWsWriteEnd;
    messageBody.t_broadcast_end = tWsWriteEnd;

    this.log.debug(
      `[PUBLISH] sent=${metrics.sentCount} skipped=${metrics.skippedCount} ` +
        `duration=${(tWsWriteEnd - publishStartTime).toFixed(2)}ms`,
    );

    // Run background operations
    await this.runBackgroundTasks(
      messageBody,
      projectId,
      keyId,
      channelName,
      topic,
      seq,
      subscriberClientIds,
      webhookUrl,
    );
  }

  /**
   * Process ErebusClient connections in batches.
   * Uses pre-serialized message string and Set-based subscriber lookup.
   */
  private async processClientBatches(
    clients: ErebusClient[],
    serialized: string,
    senderClientId: string,
    subscriberSet: Set<string>,
    topic: string,
    sentToClients: Set<string>,
    metrics: MessageMetrics,
  ): Promise<void> {
    const batchSize = this.config.batchSize;

    for (let i = 0; i < clients.length; i += batchSize) {
      const batch = clients.slice(i, i + batchSize);

      const batchResults = await Promise.all(
        batch.map((client) =>
          this.processSingleClient(
            client,
            serialized,
            senderClientId,
            subscriberSet,
            topic,
            sentToClients,
          ),
        ),
      );

      this.updateMetricsFromResults(metrics, batchResults);
    }
  }

  /**
   * Process a single client connection.
   * Uses pre-serialized message string and Set for O(1) subscriber check.
   */
  private async processSingleClient(
    client: ErebusClient,
    serialized: string,
    senderClientId: string,
    subscriberSet: Set<string>,
    topic: string,
    sentToClients: Set<string>,
  ): Promise<SocketSendResult> {
    try {
      const recipientClientId = client.clientId;

      if (sentToClients.has(recipientClientId)) {
        return { result: "duplicate", reason: "duplicate_client" };
      }

      if (client.hasHuhAccess(topic)) {
        return this.sendHuhMessage(client, sentToClients);
      } else if (client.hasReadAccess(topic)) {
        return this.sendMessage(
          client,
          serialized,
          senderClientId,
          subscriberSet,
          sentToClients,
        );
      } else {
        return { result: "skipped", reason: "no_read_scope" };
      }
    } catch (error) {
      return { result: "error", reason: "exception", error };
    }
  }

  /**
   * Send a "Huh" informational message.
   */
  private sendHuhMessage(
    client: ErebusClient,
    sentToClients: Set<string>,
  ): SocketSendResult {
    if (!client.isOpen) {
      return { result: "skipped", reason: "socket_not_open" };
    }

    client.sendJSON({
      type: "info",
      message:
        "Curious wanderer! Embark on your quest for knowledge at https://docs.erebus.sh/",
    });
    sentToClients.add(client.clientId);
    return { result: "sent", reason: "huh_scope" };
  }

  /**
   * Send message with backpressure handling.
   * Uses pre-serialized string and Set for O(1) subscriber check.
   */
  private sendMessage(
    client: ErebusClient,
    serialized: string,
    senderClientId: string,
    subscriberSet: Set<string>,
    sentToClients: Set<string>,
  ): SocketSendResult {
    const recipientClientId = client.clientId;

    // Skip sender and non-subscribers (O(1) Set lookup)
    if (
      senderClientId === recipientClientId ||
      !subscriberSet.has(recipientClientId)
    ) {
      return { result: "skipped", reason: "sender_or_not_subscribed" };
    }

    if (!client.isOpen) {
      return { result: "skipped", reason: "socket_not_open" };
    }

    // Backpressure check
    if (client.bufferedAmount > this.config.backpressureThresholdHigh) {
      return { result: "skipped", reason: "high_backpressure" };
    }

    // Send pre-serialized string directly (no per-client JSON.stringify)
    client.send(serialized);
    sentToClients.add(recipientClientId);
    return { result: "sent", reason: "normal_send" };
  }

  private updateMetricsFromResults(
    metrics: MessageMetrics,
    results: SocketSendResult[],
  ): void {
    for (const result of results) {
      switch (result.result) {
        case "sent":
          metrics.sentCount++;
          break;
        case "skipped":
          metrics.skippedCount++;
          if (result.reason === "high_backpressure") {
            metrics.highBackpressureCount++;
          }
          break;
        case "duplicate":
          metrics.duplicateCount++;
          break;
        case "error":
          metrics.errorCount++;
          break;
      }
    }
  }

  /**
   * Run background tasks.
   * Errors are logged at WARN level (not DEBUG — that was silently swallowing failures).
   */
  private async runBackgroundTasks(
    messageBody: MessageBody,
    projectId: string,
    keyId: string,
    channelName: string,
    topic: string,
    seq: string,
    subscriberClientIds: string[],
    webhookUrl: string,
  ): Promise<void> {
    await Promise.all([
      this.messageBuffer.bufferMessage(
        messageBody,
        projectId,
        channelName,
        topic,
        seq,
      ),
      this.messageBuffer.updateLastSeenBulk({
        clientIds: subscriberClientIds,
        projectId,
        channelName,
        topic,
        seq,
      }),
      enqueueUsageEvent(
        this.env,
        "websocket.message",
        projectId,
        keyId,
        messageBody.payload.length,
      ),
      this.fireWebhook(webhookUrl, keyId, messageBody),
    ]).catch((error) => {
      this.log.warn(`[BACKGROUND_TASKS] Background task error: ${error}`);
    });
  }

  /**
   * Fire a webhook notification.
   */
  private async fireWebhook(
    webhookUrl: string,
    keyId: string,
    messageBody: MessageBody,
  ): Promise<void> {
    try {
      const hmac = await generateHmac(JSON.stringify(messageBody), keyId);
      const payload: FireWebhookSchema = {
        messageBody: [messageBody],
        hmac,
      };

      const url = new URL(webhookUrl);
      const client = createRpcClient(url.origin);
      const response = await client.api.erebus.pubsub["fire-webhook"].$post({
        json: payload,
      });

      if (!response.ok) {
        this.log.warn(`[FIRE_WEBHOOK] Failed: ${response.statusText}`);
      }
    } catch (error) {
      this.log.warn(`[FIRE_WEBHOOK] Error: ${error}`);
    }
  }

  /**
   * Broadcast presence packets to all connected clients.
   * Pre-serializes both packet variants to avoid double serialization.
   * Uses Set for O(1) subscriber membership check.
   */
  async broadcastPresence(
    presencePacket: PresencePacketType,
    selfClient?: ErebusClient,
    subscribers?: string[],
  ): Promise<void> {
    this.log.debug(
      `[PRESENCE] Broadcasting for ${presencePacket.clients.length} client(s)`,
    );

    const clients = getErebusClients(this.ctx);

    // Pre-serialize BOTH variants once (fix double serialization)
    const genericSerialized = JSON.stringify(presencePacket);

    const selfSerialized: string | null =
      selfClient && subscribers && subscribers.length > 0
        ? JSON.stringify({
            packetType: "presence",
            clients: subscribers.map((subscriber) => ({
              clientId: subscriber,
              topic: presencePacket.clients[0].topic,
              status: presencePacket.clients[0].status,
            })),
          })
        : null;

    // Convert subscribers to Set for O(1) lookup
    const subscriberSet = subscribers ? new Set(subscribers) : null;

    let sentCount = 0;

    const batchSize = 50;
    for (let i = 0; i < clients.length; i += batchSize) {
      const batch = clients.slice(i, i + batchSize);

      const results = await Promise.all(
        batch.map(async (client) => {
          try {
            if (!client.isOpen) return false;

            // Filter to subscribers only
            if (subscriberSet && !subscriberSet.has(client.clientId)) {
              return false;
            }

            // Backpressure check
            if (client.bufferedAmount > this.config.backpressureThresholdHigh) {
              return false;
            }

            // Send appropriate pre-serialized packet
            if (
              selfClient &&
              selfClient.clientId === client.clientId &&
              selfSerialized
            ) {
              client.send(selfSerialized);
            } else {
              client.send(genericSerialized);
            }
            return true;
          } catch (error) {
            this.log.warn(`[PRESENCE] Failed to send to client: ${error}`);
            return false;
          }
        }),
      );

      sentCount += results.filter(Boolean).length;
    }

    this.log.debug(`[PRESENCE] Sent to ${sentCount} clients`);
  }
}
