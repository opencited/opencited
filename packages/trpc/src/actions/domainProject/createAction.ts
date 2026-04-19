import { TRPCError } from "@trpc/server";
import type { z } from "zod";
import { baseActionContextSchema } from "../../trpc";
import {
	domainProjectInsertSchema,
	domainProjectSelectSchema,
	domainProjectTable,
} from "@opencited/db";

export const createDomainProjectInputSchema = domainProjectInsertSchema;
export const createDomainProjectOutputSchema = domainProjectSelectSchema;
export const createDomainProjectContextSchema = baseActionContextSchema;

export const createDomainProjectAction = async (params: {
	input: z.infer<typeof createDomainProjectInputSchema>;
	ctx: z.infer<typeof createDomainProjectContextSchema>;
}) => {
	const { input, ctx } = params;

	const result = await ctx.db
		.insert(domainProjectTable)
		.values({
			clerkOrganizationId: input.clerkOrganizationId,
			domain: input.domain,
			logoUrl: input.logoUrl,
		})
		.returning();

	if (!result[0]) {
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: "Failed to create domain project",
		});
	}

	return result[0];
};

export const createDomainProjectHandler = async (params: {
	input: z.infer<typeof createDomainProjectInputSchema>;
	ctx: z.infer<typeof createDomainProjectContextSchema>;
}) => {
	return createDomainProjectAction(params);
};
