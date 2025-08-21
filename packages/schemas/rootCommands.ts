import { z } from 'zod';

export const RootCommandSchema = z.object({
	command: z.enum(['pause_project_id', 'unpause_project_id']),
});

export type RootCommand = z.infer<typeof RootCommandSchema>;
