import { createRpcClient } from "@repo/web/server/rpc";
import { UsagePayload } from "@repo/schemas/webhooks/usageRequest";
import { generateHmac } from "@repo/shared/utils/hmac";
import { Env } from "@/env";

function isValidBaseUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Only allow http or https, and must not have path/query/hash
    if (!["http:", "https:"].includes(parsed.protocol)) return false;
    if (parsed.pathname !== "/" && parsed.pathname !== "") return false;
    if (parsed.search || parsed.hash) return false;
    return true;
  } catch {
    return false;
  }
}

function isValidUsageWebhookPath(path: string): boolean {
  // Only allow the exact path for usage webhook
  return path === "/api/v1/webhooks/usage";
}

export class UsageWebhook {
  private readonly client: ReturnType<typeof createRpcClient>;
  private readonly usagePath = "/api/v1/webhooks/usage";
  private readonly secret: string;

  constructor(baseUrl: string, env: Env) {
    if (!isValidBaseUrl(baseUrl)) {
      throw new Error(
        `Invalid baseUrl for UsageWebhook: "${baseUrl}". Must be absolute, http(s), and not contain path/query/hash.`,
      );
    }
    this.client = createRpcClient(baseUrl);
    this.secret = env.WEBHOOK_SECRET;
  }

  async send(payload: UsagePayload): Promise<void> {
    // Strictly check that the path is correct before sending
    if (
      !isValidUsageWebhookPath(this.usagePath) ||
      typeof this.client.api?.v1?.webhooks?.usage?.$post !== "function"
    ) {
      throw new Error(
        "UsageWebhook: Invalid usage webhook path or client method not found.",
      );
    }

    const hmac = await generateHmac(JSON.stringify(payload), this.secret);

    await this.client.api.v1.webhooks.usage.$post(
      {
        json: payload,
      },
      {
        headers: {
          "X-Erebus-Hmac": hmac,
        },
      },
    );
  }
}
