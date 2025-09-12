import { expect, test } from "vitest";
import { getMetersForUserId } from "../polar/meters";

test("Testing the polar meters", async () => {
  const meters = await getMetersForUserId("test_email@v0id.me");
  expect(meters).toBeDefined();
});
