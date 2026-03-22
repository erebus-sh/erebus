import { ErebusService } from "@/service/Service";
import { expect, test } from "vitest";
import { Access } from "@/service/types";

test("ErebusService", async () => {
  /**
   * Test the ErebusService session object and its debug information.
   */
  const service = new ErebusService({
    secret_api_key: "dv-er-abcdefghijklmnopqrstuvwxyzABCDEFGsH1234abcdddddd",
  });
  const session = await service.prepareSession({ userId: "test" });

  // Must join a channel before allowing topics
  session.join("test_channel");

  // Topic must match ^[A-Za-z0-9_]+$ or be "*"
  session.allow("*", Access.Read);

  expect(session).toBeDefined();

  // Log and check the debug object for the session
  console.log(session.__debugObject);
  expect(session.__debugObject).toBeDefined();

  // Log and check the topics in the grant object
  console.log(session.__debugObject.grant.topics);
  expect(session.__debugObject.grant.topics[0]?.topic).toBe("*");
  expect(session.__debugObject.grant.topics[0]?.scope).toBe(Access.Read);

  // Check that the userId in the grant matches the input
  expect(session.__debugObject.grant.userId).toBe("test");
});
