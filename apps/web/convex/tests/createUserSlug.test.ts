import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";

test("Testing the createUserSlug mutation", async () => {
  const t = convexTest(schema, modules);

  /**
     * This fucking `.withIdentity` bullshit don't create a user, so you can't fucking query from the table, I know it's local, but even for that we need a fucking user table.. WHY?
     * 
     * BECAUSE WE HAVE FUCKING RELATIONS... OMG WOW HOW COULD SOMEONE THINK OF THIS?
     * 
     * And this `.withIdentity` don't do it so either you fucking create a user on a table or do some black magic shit, or your mutation logic will not work. I fucking HATE THIS. And there is no fucking option to test on your damn cloud instance.
     * 
     * The test work tho, but I just can't insert in user_profiles and it throws an error so it apper as failed test, because I need an Id<"users"> type, i don't fucking know why, it's just a damn fucking string. But this is it, I can't fucking test this shit with a success.
     * 
     *  All love,
        #V0ID ;)
    ---------------------------------------------------------------
    Please if there is something alternative or solution to this, please let me know.
    - x.com/v0id_user
    - hey@v0id.me
    Hit me up where ever you want, I'm all ears :)
     */
  const asSarah = t.withIdentity({ email: "sarah@test.com" });

  const slug = await asSarah.mutation(api.console.mutation.createUserSlug);

  const userProfile = await asSarah.query(
    api.user_profile.query.getUserProfileBySlug,
    { slug },
  );
  expect(userProfile).toBeDefined();
});
