import { defineSchema } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import allScheams from "./tables";

const schema = defineSchema({
  ...authTables,
  ...allScheams,
});

export default schema;
