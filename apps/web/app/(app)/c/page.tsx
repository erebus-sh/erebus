/**
 * This page is a server component that is used to initialize the user slug
 * which is something like an organization for a user. If it's already set,
 * we redirect to the slug page.
 */

import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { redirect } from "next/navigation";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { ConvexError } from "convex/values";

export const dynamic = "force-dynamic";

export default async function ConsolePage() {
  let createUserSlug: string | null = null;
  try {
    const token = await convexAuthNextjsToken();
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

    // It's can't be called in here because it will throw a NEXT_REDIRECT error
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
