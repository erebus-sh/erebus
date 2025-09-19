import { ErebusService, Access } from "@erebus-sh/sdk/service";
import { createRouteHandler } from "@erebus-sh/sdk/server/next";
import { cookies } from "next/headers";

// export const { POST } = createRouteHandler({
//  authorize: async (channel, ctx) => {
//    // Get user ID from cookies or headers
//    const ckis = await cookies();
//    const userId = ckis.get("x-User-Id")?.value;
//    if (!userId) {
//      throw new Error("Missing user id");
//    }

//    // Create a new service instance
//    const service = new ErebusService({
//      // Replace with your own secret_api_key
//      secret_api_key: "dv-er-4o7j90qw39p96bra19fa94prupp6vdcg9axrd3hg4hqy68c1",
//    });

//    // Prepare a session for the user id
//    const session = await service.prepareSession({
//      userId,
//    });

//    // Allow one single channel for the user
//    session.join(channel);

//    // Allow one single topic or multiple topics for the user up to 64 topics
//    // Give it Read or Write or ReadWrite access
//    session.allow("rm_123", Access.ReadWrite);

//    // Return the session instance
//    return session;
//  },
// });

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
