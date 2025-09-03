import type { Access } from "@repo/schemas/grant";
import { baseClient } from "./baseClient";
import { ErebusError } from "../internal/error";
import type { GrantRequest } from "@repo/schemas/request/grantChannelRequest";
import { HTTPError } from "ky";

export class ErebusSession {
  constructor(
    private readonly grantRequest: GrantRequest,
    private readonly client: ReturnType<typeof baseClient>,
  ) {
    if (!this.grantRequest.secret_key) {
      throw new ErebusError(
        [
          "Secret key is required to create a session. Use the ErebusService class method.",
          "example:",
          "const service = new ErebusService({ secret_api_key: 'test' });",
          "const session = await service.prepareSession({ userId: 'test' });",
        ].join("\n"),
      );
    }
    if (!this.grantRequest.userId) {
      throw new ErebusError(
        [
          "User ID is required to create a session. Use the ErebusService class method.",
          "example:",
          "const service = new ErebusService({ secret_api_key: 'test' });",
          "const session = await service.prepareSession({ userId: 'test' });",
        ].join("\n"),
      );
    }
    // Set default expiration to 2 hours from now
    this.grantRequest.expiresAt = Math.floor(Date.now() / 1000) + 2 * 60 * 60; // 2 hours from now
  }

  public join(channel: string) {
    if (!channel) {
      throw new ErebusError("Channel is required to join.");
    }

    if (!/^[A-Za-z0-9_]+$/.test(channel)) {
      throw new ErebusError(
        "Channel name must not contain spaces or special characters. Only letters, numbers, and underscores are allowed.",
      );
    }

    if (channel.length > 64) {
      throw new ErebusError("Channel name must be less than 64 characters.");
    }

    this.grantRequest.channel = channel;
  }

  public allow(topic: string, scope: Access) {
    if (!this.grantRequest.channel) {
      throw new ErebusError(
        [
          "You must set a channel before allowing access to any topics.",
          "Please call join(channel) first.",
          "example:",
          "session.join('channel_name');",
        ].join("\n"),
      );
    }

    if (!topic) {
      throw new ErebusError("Topic is required to allow access.");
    }

    if (topic !== "*" && !/^[A-Za-z0-9_]+$/.test(topic)) {
      throw new ErebusError(
        "Topic name must not contain spaces or special characters. Only letters, numbers, and underscores are allowed. Use '*' to allow all topics.",
      );
    }

    if (topic.length > 64) {
      throw new ErebusError("Topic name must be less than 64 characters.");
    }

    if (this.grantRequest.topics.length > 64) {
      throw new ErebusError(
        "Connecting to more than 64 topics at once is inefficient. Please reduce the number of topics in this grant.",
      );
    }

    if (!scope) {
      throw new ErebusError("Scope is required to allow access.");
    }

    this.grantRequest.topics.push({
      topic,
      scope,
    });
  }

  public setExpiration(expiration: number) {
    const now = Math.floor(Date.now() / 1000); // current time in seconds
    const min = now + 10 * 60; // 10 minutes from now
    const max = now + 2 * 60 * 60; // 2 hours from now

    if (typeof expiration !== "number" || !Number.isFinite(expiration)) {
      throw new ErebusError(
        "Expiration must be a valid number (unix timestamp in seconds).",
      );
    }
    if (expiration < min) {
      throw new ErebusError("Expiration must be at least 10 minutes from now.");
    }
    if (expiration > max) {
      throw new ErebusError("Expiration cannot be more than 2 hours from now.");
    }
    this.grantRequest.expiresAt = expiration;
  }

  /**
   * Last function to be called to get the signed JWT token.
   *
   * @returns
   */
  public async authorize(): Promise<string> {
    if (!this.grantRequest.channel) {
      throw new ErebusError(
        "You must set a channel before allowing access to any topics. Please call join(channel) first.",
      );
    }

    if (this.grantRequest.topics.length === 0) {
      throw new ErebusError(
        [
          "At least one topic is required. Please use the allow method to grant access to topics.",
          "example:",
          "session.allow('topic-1', Access.Read);",
        ].join("\n"),
      );
    }

    if (this.grantRequest.topics.length > 64) {
      throw new ErebusError(
        [
          "Connecting to more than 64 topics at once is inefficient. Please reduce the number of topics in this grant.",
        ].join("\n"),
      );
    }

    const request = this.grantRequest;
    try {
      const response = await this.client.post("api/v1/grant-channel", {
        json: request,
      });

      if (!response.ok) {
        throw new ErebusError(
          [
            "The server returned an error.",
            "Please check your API key and ensure you have provided a valid topics array (at least one and less than 64 topics). Please try again.",
            "If the problem persists, please contact support: sdk@erebus.sh",
          ].join("\n"),
        );
      }
      console.log(
        "[ErebusSession.authorize] Response received for user:",
        this.grantRequest.userId,
      );
      const data = (await response.json()) as { grant_jwt: string };
      if (!data) {
        throw new ErebusError(
          [
            "The server returned an empty response or invalid data.",
            "Please check your API key and try again.",
            "If the problem persists, please contact support: sdk@erebus.sh",
          ].join("\n"),
        );
      }
      return data.grant_jwt;
    } catch (error: unknown) {
      if (error instanceof HTTPError) {
        console.error(error);
        if (error.response.status === 401) {
          throw new ErebusError(
            "Invalid API key or token. Please check your API key and try again.",
            JSON.stringify(await error.response.json()),
          );
        } else if (error.response.status === 400) {
          throw new ErebusError(
            "Invalid topics array. Please check your topics array and try again.",
            JSON.stringify(await error.response.json()),
          );
        } else if (error.response.status === 500) {
          throw new ErebusError(
            "Internal server error. Please try again later.",
            JSON.stringify(await error.response.json()),
          );
        }
        throw new ErebusError(
          `Failed to get token: ${error.response.statusText}`,
          JSON.stringify(await error.response.json()),
        );
      }
      throw error;
    }
  }

  /**
   * Debug object for the session.
   */
  get __debugObject(): {
    grant: GrantRequest;
    client: ReturnType<typeof baseClient>;
  } {
    return {
      grant: this.grantRequest,
      client: this.client,
    };
  }
}
