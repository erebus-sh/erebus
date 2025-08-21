import { ErebusService } from "@/service/Service";
import { expect, test } from "vitest";
import { Access } from "@/internal/schemas/grant";

test("ErebusService", async () => {
  /**
   * Test the ErebusService session object and its debug information.
   */
  const service = new ErebusService({ secret_api_key: "test" }); // Create a new ErebusService instance with "test" as the secret api key
  const session = await service.prepareSession({ userId: "test" }); // Prepare a session for userId "test"
  session.allow("test:*", Access.Read); // Allow read access to all topics matching "test:*"
  expect(session).toBeDefined(); // The session object should be defined

  // Log and check the debug object for the session
  console.log(session.__debugObject);
  expect(session.__debugObject).toBeDefined();

  // Log and check the topics in the grant object
  console.log(session.__debugObject.grant.topics);
  expect(session.__debugObject.grant.topics[0]?.topic).toBe("test:*"); // The first topic should be "test:*"
  expect(session.__debugObject.grant.topics[0]?.scope).toBe(Access.Read); // The scope should be Access.Read

  // Check that the userId in the grant matches the input
  expect(session.__debugObject.grant.userId).toBe("test");
});
