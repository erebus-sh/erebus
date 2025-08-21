import { createRpcClient } from "@repo/web/server/rpc";
import { UsagePayload } from "@repo/schemas/webhooks/usageRequest";

export class UsageWebhook {
  private readonly client: ReturnType<typeof createRpcClient>;

  constructor(baseUrl: string) {
    this.client = createRpcClient(baseUrl);
  }

  async send(payload: UsagePayload): Promise<void> {
    await this.client.api.v1.webhooks.usage.$post({
      json: payload,
    });
  }
}
