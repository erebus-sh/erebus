import { createChannel } from "@erebus-sh/sdk/react";
import { z } from "zod";

// Create typed schemas for the channels you want to use
export const schema = {
  chat: z.object({
    message: z.string(),
    sentAt: z.number(),
  }),
};

// Create a channel hook
export const useChannel = createChannel(schema);
