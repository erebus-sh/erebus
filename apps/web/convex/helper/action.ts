import { action } from "../_generated/server";

export const getCurrentServerTime = action(async (ctx, args) => {
  return Date.now();
});
