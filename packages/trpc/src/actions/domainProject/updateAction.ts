import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import type { z } from "zod";
import { baseActionContextSchema } from "../../trpc";
import {
	domainProjectSelectSchema,
	domainProjectTable,
	domainProjectUpdateSchema,
} from "@opencited/db";

export const updateDomainProjectInputSchema = domainProjectUpdateSchema;
export const updateDomainProjectOutputSchema = domainProjectSelectSchema;
export const updateDomainProjectContextSchema = baseActionContextSchema;

export const updateDomainProjectAction = async (params: {
	input: z.infer<typeof updateDomainProjectInputSchema>;
	ctx: z.infer<typeof updateDomainProjectContextSchema>;
	clerkOrganizationId: string;
}) => {
	const { input, ctx, clerkOrganizationId } = params;

	const result = await ctx.db
		.update(domainProjectTable)
		.set(input)
		.where(eq(domainProjectTable.clerkOrganizationId, clerkOrganizationId))
		.returning();

	if (!result[0]) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Domain project not found",
		});
	}

	return result[0];
};

export const updateDomainProjectHandler = async (params: {
	input: z.infer<typeof updateDomainProjectInputSchema>;
	ctx: z.infer<typeof updateDomainProjectContextSchema>;
	clerkOrganizationId: string;
}) => {
	return updateDomainProjectAction(params);
};
