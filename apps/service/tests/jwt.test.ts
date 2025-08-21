import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import { verifyRequestToken } from "@/lib/grants_jwt";

const token =
  "eyJhbGciOiJFZERTQSJ9.eyJwcm9qZWN0X2lkIjoiazU3ZTl4Zmo5N2RhMHdxcjM3MnQ5cHh6YTU3bXp0cTYiLCJjaGFubmVsIjoidGVzdCIsInRvcGljcyI6W3sidG9waWMiOiJ0ZXN0Iiwic2NvcGUiOiJyZWFkIn1dLCJ1c2VySWQiOiJ0ZXN0IiwiaXNzdWVkQXQiOjE3NTUzMjg4MzIsImV4cGlyZXNBdCI6MTc1NTMzNjAzMSwiaWF0IjoxNzU1MzI4ODMyLCJleHAiOjE3NTUzMzYwMzJ9.P9M5VBNQZi7wus_9JF2xe-JSbAg88plIRvrjT-xAnCmJccODri5zsBgCsL_5NlkJJy-UJB0NPegxgQ3hdWyaDQ";

describe("JWT", () => {
  it("should verify a valid grant token", async () => {
    const result = await verifyRequestToken(token, env.PUBLIC_KEY_JWK);
    expect(result).not.toBeNull();
    console.log(result);
  });
});
