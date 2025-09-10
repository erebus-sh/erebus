import { z } from "zod";

export const RootCommandSchema = z.object({
  command: z.enum(["pause_project_id", "unpause_project_id"]),
  projectId: z.string(),
  channel: z.string(),
});

export type RootCommand = z.infer<typeof RootCommandSchema>;
