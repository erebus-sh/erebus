import { action } from "../_generated/server";
import { getMetersForUserId } from "../polar/meters";
import { api } from "../_generated/api";
import { ConvexError } from "convex/values";

/**
 * Get user including usage meters and balance
 *
 * This is an action (not a query or mutation) because it contains side effects
 * by calling the Polar SDK to fetch real-time usage data. Actions are the only
 * Convex functions that can make external API calls and perform side effects.
 */
export const getUserWithMeters = action({
  handler: async (ctx) => {
    const user = await ctx.runQuery(api.users.query.getMeWithSubscription);
    if (!user || !user._id) throw new ConvexError("User not found");

    const meters = await getMetersForUserId(user._id);

    return {
      balance: meters.balance,
      consumedUnits: meters.consumedUnits,
      creditedUnits: meters.creditedUnits,
      ...user,
    };
  },
});
