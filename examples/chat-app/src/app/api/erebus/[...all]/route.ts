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
      secret_api_key: "dv-er-4o7j90qw39p96bra19fa94prupp6vdcg9axrd3hg4hqy68c1",
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
