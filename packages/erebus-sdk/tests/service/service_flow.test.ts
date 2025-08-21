import { ErebusService } from "@/service/Service";
import { Access } from "@/service/types";
import { test, expect } from "vitest";

test("service flow fails because of no topics", async () => {
  // Use a valid secret_api_key according to SECRET_KEY_REGEX in grantChannelRequest.ts
  // ^(sk-er-|dv-er-)[\w-]{48}$
  // Example: "sk-er-" + 48 alphanumeric or dash/underscore chars
  const secret_api_key =
    "dv-er-abcdefghijklmnopqrstuvwxyzABCDEFGsH1234abcdddddd";
  const service = new ErebusService({
    secret_api_key,
    base_url: "http://localhost:3000",
  });

  const session = await service.prepareSession({ userId: "test" });
  session.join("test");
  // .authorize() is async and should throw because there are no topics
  await expect(
    session.authorize(),
    "should throw because of no topics",
  ).rejects.toThrow(/At least one topic is required/);
});

test("Erebus service server should return 401 when invalid token is provided", async () => {
  const secret_api_key =
    "dv-er-abcdefghijklmnopqrstuvwxyzABCDEFGsH1234abcdddddd";
  const service = new ErebusService({
    secret_api_key,
    base_url: "http://localhost:3000",
  });

  const session = await service.prepareSession({ userId: "test" });
  session.join("test");
  session.allow("test", Access.Read);
  await expect(
    session.authorize(),
    "should throw because of bad token",
  ).rejects.toThrowError(
    /Invalid (API key or token|topics array)\. Please check your (API key|topics array) and try again\./,
  );
});

test("Erebus service server should return 200 with grant jwt token with read write access", async () => {
  const secret_api_key =
    "dv-er-p14umx0nlo8d5vuam32y0fn_qe8tnzyynsbp9n__mgjf_yq6";
  const service = new ErebusService({
    secret_api_key,
    base_url: "http://localhost:3000",
  });
  const session = await service.prepareSession({ userId: "test" });
  session.join("test");
  session.allow("test", Access.ReadWrite);
  const grantJWT = await session.authorize();
  console.log(grantJWT);
  expect(grantJWT).toBeDefined();
  // grantJWT is a JWT, which is three base64url-encoded parts separated by dots
  expect(grantJWT).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
});
