import ky from "ky";
import { Env } from "@/env";
import { Webhook } from "./webhook";
import { UsagePayload } from "@repo/schemas/webhooks/usageRequest";
// TODO: Implement usage tracking webhooks here
export class UsageWebhook {
  private readonly webhook: Webhook;
  constructor(
    private readonly env: Env,
    baseUrl: string,
  ) {
    this.webhook = new Webhook(env, baseUrl);
  }

  async sendUsage(usage: UsagePayload) {
    await this.webhook.send("usage", usage);
  }
}
