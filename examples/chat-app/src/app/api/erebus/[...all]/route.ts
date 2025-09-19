import { ErebusService, Access } from "@erebus-sh/sdk/service";
import { createRouteHandler } from "@erebus-sh/sdk/server/next";
import { cookies } from "next/headers";

export const { POST } = createRouteHandler({
  authorize: async (channel, ctx) => {
    const ckis = await cookies();
    const userId = ckis.get("x-User-Id")?.value;
    if (!userId) {
      throw new Error("Missing user id");
    }

    const service = new ErebusService({
      secret_api_key: "dv-er-a9ti6g5fnybi2mug3t5mi5o7w27121ehxsy8l6nf5xijxzu4",
      base_url: "http://localhost:3000",
    });

    const session = await service.prepareSession({
      userId,
    });

    session.join(channel);
    session.allow("*", Access.ReadWrite);

    return session;
  },
  fireWebhook: async (webHookMessage) => {
    // noop
  },
});
