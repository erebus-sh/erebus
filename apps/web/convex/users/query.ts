import { getAuthUserId } from "@convex-dev/auth/server";
import { internalQuery, query } from "../_generated/server";
import { polar } from "../polar";
import type { Subscription } from "@convex-dev/polar";
import { v } from "convex/values";
import { api } from "../_generated/api";

// Helper function to determine if a subscription is active
function isSubscriptionActive(
  subscription: Subscription | null | undefined,
): boolean {
  if (!subscription) return false;

  const now = new Date();

  // Basic status checks
  const isStatusActive = subscription.status === "active";
  const hasNotEnded = subscription.endedAt === null;
  const hasStarted = subscription.startedAt !== null;
  const notCancelling = !subscription.cancelAtPeriodEnd;

  // Date range checks
  const periodStart = subscription.currentPeriodStart
    ? new Date(subscription.currentPeriodStart)
    : null;
  const periodEnd = subscription.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd)
    : null;

  const withinPeriod =
    periodStart && periodEnd ? now >= periodStart && now <= periodEnd : true;

  return (
    isStatusActive && hasNotEnded && hasStarted && notCancelling && withinPeriod
  );
}

// Helper function to determine if a user has already subscribed (ever had a subscription)
function hasAlreadySubscribed(
  subscription: Subscription | null | undefined,
): boolean {
  // If there's any subscription record, they've subscribed before
  // This covers cancelled subscriptions, expired periods, etc.
  return subscription !== null && subscription !== undefined;
}

export const getMe = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const user = await ctx.db.get(userId);
    return {
      ...user,
    };
  },
});

export const getMeWithSubscription = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const [subscription, user] = await Promise.all([
      polar.getCurrentSubscription(ctx, {
        userId: userId,
      }),
      ctx.db.get(userId),
    ]);
    return {
      ...user,
      periodEnd: subscription?.currentPeriodEnd,
      isSubscriptionActive: isSubscriptionActive(subscription),
      hasAlreadySubscribed: hasAlreadySubscribed(subscription),
    };
  },
});

export const getUserById = internalQuery({
  args: {
    id: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});
