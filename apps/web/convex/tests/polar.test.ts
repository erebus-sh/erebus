import { expect, test } from "vitest";
import { getUsageSnapshotForUser } from "../polar/meters";

test("Testing the polar meters", async () => {
  const meters = await getUsageSnapshotForUser("test_email@v0id.me");
  expect(meters).toBeDefined();
});
