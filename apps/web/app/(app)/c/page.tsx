/**
 * This page is a server component that is used to initialize the user slug
 * which is something like an organization for a user. If it's already set,
 * we redirect to the slug page.
 */

import { fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { redirect } from "next/navigation";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { ConvexError } from "convex/values";
import { Reason } from "@/app/enums/reason";

export const dynamic = "force-dynamic";

export const dynamicParams = false;

export default async function ConsolePage() {
  let createUserSlug: string | null = null;
  const token = await convexAuthNextjsToken();

  // Check if the user have an active subscription
  const user = await fetchQuery(
    api.users.query.getMeWithSubscription,
    {},
    { token },
  );

  if (!user) {
    // Straight up, get out of here >=(
    // Altho the middleware should handle this,
    // but just in case, we know it can't be fully trusted
    // https://www.picussecurity.com/resource/blog/cve-2025-29927-nextjs-middleware-bypass-vulnerability :P
    redirect(`/sign-in?next=/c`);
  }

  if (!user?.isSubscriptionActive) {
    if (user?.hasAlreadySubscribed) {
      // First heist was successful and I stole your money >=)
      // Subscription expired, so back we go to rerun the same crime
      // Capitalism baby lessgo

      // TODO: Probably locking the user from the console is not good option,
      //       for now keep it, until we improve the logic
      redirect(`/pricing?reason=${Reason.EXPIRED}`);
    } else {
      // Redirect to the pricing page,
      // must steal your money before you can access the console
      // I'm not YC backed :(
      // Am I going to stop doing these comments? No.
      redirect(`/pricing?reason=${Reason.FIRST_TIME}`);
    }
  }

  try {
    const createUserSlugResult = await fetchMutation(
      api.console.mutation.createUserSlug,
      {},
      // You need to manually pass the token to the mutation every time you call it from SSR
      { token },
    );

    createUserSlug = createUserSlugResult;

    /**
     * Server side component does not have to return a value, but it's because we are must going to redirect to the slug page
     */

    // It can't be called in here because it will throw a NEXT_REDIRECT error
    // redirect(`/c/${createUserSlug}`);

    if (!createUserSlug) throw new ConvexError("Slug was not created properly");
  } catch (error: unknown) {
    console.error(error);

    let message: string | null = null;
    if (error instanceof Error) {
      message = error.message;
    }

    return (
      <div className="font-mono text-sm text-zinc-200">
        Opss... you are not supposed to see this. Please contact hey@v0id.me
        personally to solve it.
        <br />
        <br />
        {message && (
          <span className="font-mono text-xs">
            <b>Error info (might be useful):</b>
            <br />
            {message}
          </span>
        )}
      </div>
    );
  }

  redirect(`/c/${createUserSlug}`);
}
