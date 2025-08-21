import { ErebusError } from "@/service/error";
import { ErebusSession } from "@/service/session";
import { expect, test } from "vitest";
import { baseClient } from "@/service/baseClient";

test("ErebusError and test some functions to error out", () => {
  const error = new ErebusError("test");
  expect(error).toBeDefined();

  // ErebusSession expects (grant, client) as separate arguments, not an object.
  // To make it error out, we can pass a grant missing userId, which should throw.
  expect(() => {
    new ErebusSession(
      {
        // userId is missing to trigger the error
        channel: "test",
        topics: [],
        project_id: "test",
        issuedAt: 0,
        expiresAt: 0,
      } as any, // cast to any to bypass TS error for test
      baseClient({ base_url: "http://localhost:3000" }),
    );
  }).toThrowError(/User ID is required to create a session/);
});
