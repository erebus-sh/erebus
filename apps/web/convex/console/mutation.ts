import { mutation } from "../_generated/server";
import { api } from "../_generated/api";
import slugify from "slugify";
import { shuffleStringAndObfuscate } from "../utils/shuffle";
import { customAlphabet } from "nanoid";
import { Id } from "../_generated/dataModel";
import { ConvexError } from "convex/values";

function logWithTag(tag: string, fn: string, ...args: unknown[]) {
  console.log(`[${fn}] [${tag}]`, ...args);
}

export const createUserSlug = mutation({
  async handler(ctx): Promise<string> {
    const FN = "createUserSlug";
    logWithTag("start", FN, "Starting createUserSlug mutation");

    const user = await ctx.runQuery(api.users.query.getMeWithSubscription);
    logWithTag("user", FN, "Fetched user", user);

    if (!user || !user._id) {
      logWithTag("error", FN, "User not authenticated or not found", user);
      throw new ConvexError(
        "Invalid transaction, the user is not authenticated or not found",
      );
    }

    // Check the user has a slug return it
    const userSlugQuery = await ctx.db
      .query("user_profiles")
      .withIndex("by_user", (q) => q.eq("userId", user._id as Id<"users">))
      .unique();
    logWithTag(
      "userSlugQuery",
      FN,
      "Queried for existing user slug in user_profiles",
      userSlugQuery,
    );

    if (userSlugQuery) {
      logWithTag(
        "return-existing",
        FN,
        "Returning existing user slug",
        userSlugQuery.slug,
      );
      return userSlugQuery.slug;
    }

    const nanoid_local = customAlphabet(
      "abcdefghijklmnopqrstuvwxyz0123456789",
      6,
    ); // 36^6 = 2.1B combos
    // Extract and sanitize the email prefix
    let emailName = user.email!.split("@")[0] ?? "";
    logWithTag("emailName-initial", FN, "Initial emailName", emailName);

    // Remove funky characters (., _, emoji, etc.) that slugify would strip anyway
    emailName = emailName.replace(/[^a-zA-Z0-9]/g, "");
    logWithTag("emailName-sanitized", FN, "Sanitized emailName", emailName);

    // Ensure minimum slug entropy — pad short names with random characters
    if (emailName.length < 3) {
      const padding = nanoid_local(3 - emailName.length);
      logWithTag("padding", FN, "Padding short emailName", padding);
      emailName += padding;
    }

    if (!emailName) {
      logWithTag("error", FN, "User email prefix is empty or invalid");
      throw new ConvexError("User email prefix is empty or invalid");
    }

    let finalSlug: string | undefined;
    let attempt = 0;
    const maxAttempts = 3;

    while (attempt < maxAttempts) {
      const randomId = nanoid_local();
      const shuffled = shuffleStringAndObfuscate(emailName);
      const userSlug = slugify(shuffled, { lower: true, strict: true });

      logWithTag("slug-attempt", FN, {
        attempt,
        shuffled,
        userSlug,
        randomId,
      });

      if (!userSlug || userSlug.length < 2) {
        logWithTag("error", FN, "User slug is invalid", userSlug);
        throw new ConvexError("User slug is invalid");
      }

      finalSlug = `${userSlug}-${randomId}`;
      logWithTag("finalSlug-candidate", FN, finalSlug);

      const exists = await ctx.db
        .query("user_profiles")
        .withIndex("by_slug", (q) => q.eq("slug", finalSlug!))
        .unique();

      logWithTag("slug-exists", FN, { finalSlug, exists });

      if (!exists) break;

      attempt++;
    }

    if (attempt === maxAttempts) {
      logWithTag(
        "error",
        FN,
        "Failed to generate a unique user slug after 3 attempts",
      );
      throw new ConvexError(
        "Failed to generate a unique user slug after 3 attempts",
      );
    }

    if (!finalSlug || finalSlug.length < 2) {
      logWithTag("error", FN, "Final slug invalid after attempts", finalSlug);
      throw new ConvexError(
        "Failed to generate a unique user slug after 3 attempts",
      );
    }

    // User slug is stored in the user_profiles table
    // Keep in mind that Project slugs are different from user slugs
    await ctx.db.insert("user_profiles", {
      userId: user._id,
      slug: finalSlug,
      createdAt: Date.now(),
    });

    logWithTag("success", FN, "Inserted new user profile with slug", finalSlug);

    return finalSlug;
  },
});
