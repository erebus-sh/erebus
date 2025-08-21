import ky from "ky";
import { Env } from "@/env";

export class Webhook {
  private readonly baseUrl: string;
  constructor(
    private readonly env: Env,
    baseUrl: string,
  ) {
    this.baseUrl = baseUrl;
  }

  async send<T = unknown>(path: string, payload: T): Promise<void> {
    await ky.post(`${this.baseUrl}/api/v1/webhooks/${path}`, {
      json: payload,
    });
  }
}
