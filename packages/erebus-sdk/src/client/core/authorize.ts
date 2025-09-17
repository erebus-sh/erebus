import { logger } from "@/internal/logger/consola";
import { createRpcClient } from "@/server/rpc";

/**
 * This will call the server to generate a grant token
 */
export class Authorize {
  private client: ReturnType<typeof createRpcClient>;

  constructor(baseUrl: string) {
    logger.info("[AUTHORIZE] Constructor called with baseUrl:", baseUrl);
    this.client = createRpcClient(baseUrl);
    logger.info("[AUTHORIZE] RPC client created successfully");
  }

  /**
   * Calls the server to generate a grant token
   * @returns The grant JWT token
   */
  async generateToken(channel: string): Promise<string> {
    logger.info("[AUTHORIZE] generateToken called with channel:", channel);
    try {
      logger.info("[AUTHORIZE] Making POST request to generate-token endpoint");
      const response = await this.client["api"]["erebus"]["pubsub"][
        "grant"
      ].$post({
        json: {
          channel,
        },
      });

      if (!response.ok) {
        logger.error(
          `[AUTHORIZE] generateToken failed with status: ${response.status} ${response.statusText}`,
        );
        throw new Error(
          `The auth call failed: ${response.status} ${response.statusText}\nresponse: ${await response.text()}\nPath: ${response.url}`,
        );
      }

      const data = await response.json();
      logger.info("[AUTHORIZE] generateToken successful, token generated");
      return data.grant_jwt;
    } catch (error) {
      logger.error(
        `[AUTHORIZE] generateToken error: ${error instanceof Error ? error.message : "Unknown error"}`,
        {
          error: error instanceof Error ? error.message : "Unknown error",
        } as Record<string, unknown>,
      );
      throw new Error(
        `Failed to generate token: ${error instanceof Error ? error.message : "Unknown error"}`,
        {
          error: error instanceof Error ? error.message : "Unknown error",
        } as Record<string, unknown>,
      );
    }
  }
}
