import { createRpcClient } from "@/server/rpc";

/**
 * This will call the server to generate a grant token
 */
export class Authorize {
  private client: ReturnType<typeof createRpcClient>;

  constructor(baseUrl: string) {
    console.log("[AUTHORIZE] Constructor called with baseUrl:", baseUrl);
    this.client = createRpcClient(baseUrl);
    console.log("[AUTHORIZE] RPC client created successfully");
  }

  /**
   * Calls the server to generate a grant token
   * @returns The grant JWT token
   */
  async generateToken(channel: string): Promise<string> {
    console.log("[AUTHORIZE] generateToken called with channel:", channel);
    try {
      console.log("[AUTHORIZE] Making POST request to generate-token endpoint");
      const response = await this.client["api"]["generate-token"].$post({
        json: {
          channel,
        },
      });

      if (!response.ok) {
        console.error(
          "[AUTHORIZE] generateToken failed with status:",
          response.status,
          response.statusText,
        );
        throw new Error(
          `The auth call failed: ${response.status} ${response.statusText} ${await response.text()}`,
        );
      }

      const data = await response.json();
      console.log("[AUTHORIZE] generateToken successful, token generated");
      return data.grant_jwt;
    } catch (error) {
      console.error(
        "[AUTHORIZE] generateToken error:",
        error instanceof Error ? error.message : "Unknown error",
      );
      throw new Error(
        `Failed to generate token: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Calls the server health check endpoint
   * @returns Promise with health check response
   */
  async healthCheck() {
    console.log("[AUTHORIZE] healthCheck called");
    try {
      console.log(
        "[AUTHORIZE] Making GET request to health-not-meaningful endpoint",
      );
      const response = await this.client["api"]["health-not-meaningful"].$get();
      const data = await response.json();
      console.log("[AUTHORIZE] healthCheck successful, response received");
      return data;
    } catch (error) {
      console.error(
        "[AUTHORIZE] healthCheck error:",
        error instanceof Error ? error.message : "Unknown error",
      );
      throw new Error(
        `Health check failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Calls the server to generate a test token
   * @returns Promise with the test token response
   */
  async generateTestToken() {
    console.log("[AUTHORIZE] generateTestToken called");
    try {
      console.log(
        "[AUTHORIZE] Making GET request to generate-token-test endpoint",
      );
      const response = await this.client["api"]["generate-token-test"].$get();

      if (!response.ok) {
        console.error(
          "[AUTHORIZE] generateTestToken failed with status:",
          response.status,
        );
        const errorData = await response.json();
        console.log("[AUTHORIZE] generateTestToken error response:", errorData);
        return errorData;
      }

      const data = await response.json();
      console.log(
        "[AUTHORIZE] generateTestToken successful, test token generated",
      );
      return data;
    } catch (error) {
      console.error(
        "[AUTHORIZE] generateTestToken error:",
        error instanceof Error ? error.message : "Unknown error",
      );
      throw new Error(
        `Failed to generate test token: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}
