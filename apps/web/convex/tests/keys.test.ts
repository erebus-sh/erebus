import { generateApiKey } from "../utils/api_key";
import { expect, test } from "vitest";

test("generateApiKey", async () => {
  for (let i = 0; i < 100; i++) {
    const key = generateApiKey(true);
    console.log(key);
    expect(key).toMatch(/sk-er-[\w-]{48}/);
  }
});
