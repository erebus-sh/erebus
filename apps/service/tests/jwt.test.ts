import { describe, it, expect } from "vitest";
import { verifyRequestToken } from "@/lib/grants_jwt";
import { createTestToken, TEST_PUBLIC_KEY_JWK_STRING } from "./test-utils";

describe("JWT", () => {
  it("should verify a valid grant token", async () => {
    const token = await createTestToken({
      project_id: "test_project",
      channel: "test",
      topics: [{ topic: "test", scope: "read" }],
      userId: "test",
      key_id: "test-key",
      webhook_url: "https://example.com/webhook",
    });

    const result = await verifyRequestToken(token, TEST_PUBLIC_KEY_JWK_STRING);
    expect(result).not.toBeNull();
    expect(result?.channel).toBe("test");
    expect(result?.project_id).toBe("test_project");
  });
});
