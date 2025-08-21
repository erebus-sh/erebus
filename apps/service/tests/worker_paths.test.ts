import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

describe("Hello World worker", () => {
  it("responds with not found and proper status for /404", async () => {
    const response = await SELF.fetch("http://localhost:8787/blah-blah-blah");
    console.log(await response.statusText);
    expect(await response.status).toBe(404);

    const response2 = await SELF.fetch("http://localhost:8787/umbra");
    console.log(await response2.statusText);
    expect(await response2.status).toBe(400);
  });
});
