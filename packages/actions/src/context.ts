import { z } from "zod";

export const baseActionContextSchema = z.object({
	userId: z.string().nullable(),
	isAuthenticated: z.boolean(),
	db: z.any(),
});

export type Context = z.infer<typeof baseActionContextSchema>;
