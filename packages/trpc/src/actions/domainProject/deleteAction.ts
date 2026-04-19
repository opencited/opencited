import { eq } from "drizzle-orm";
import { z } from "zod";
import { baseActionContextSchema } from "../../trpc";
import { domainProjectSelectSchema, domainProjectTable } from "@opencited/db";

export const deleteDomainProjectInputSchema = z.object({});
export const deleteDomainProjectOutputSchema =
	domainProjectSelectSchema.nullable();
export const deleteDomainProjectContextSchema = baseActionContextSchema;

export const deleteDomainProjectAction = async (params: {
	ctx: z.infer<typeof deleteDomainProjectContextSchema>;
	clerkOrganizationId: string;
}) => {
	const { ctx, clerkOrganizationId } = params;

	const result = await ctx.db
		.delete(domainProjectTable)
		.where(eq(domainProjectTable.clerkOrganizationId, clerkOrganizationId))
		.returning();

	return result[0] || null;
};

export const deleteDomainProjectHandler = async (params: {
	ctx: z.infer<typeof deleteDomainProjectContextSchema>;
	clerkOrganizationId: string;
}) => {
	return deleteDomainProjectAction(params);
};
