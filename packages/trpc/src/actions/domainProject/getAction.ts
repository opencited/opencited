import { eq } from "drizzle-orm";
import { z } from "zod";
import { baseActionContextSchema } from "../../trpc";
import { domainProjectSelectSchema, domainProjectTable } from "@opencited/db";

export const getDomainProjectInputSchema = z.object({}).optional();
export const getDomainProjectOutputSchema =
	domainProjectSelectSchema.nullable();
export const getDomainProjectContextSchema = baseActionContextSchema;

export const getDomainProjectAction = async (params: {
	ctx: z.infer<typeof getDomainProjectContextSchema>;
	clerkOrganizationId: string;
}) => {
	const { ctx, clerkOrganizationId } = params;

	const result = await ctx.db
		.select()
		.from(domainProjectTable)
		.where(eq(domainProjectTable.clerkOrganizationId, clerkOrganizationId))
		.limit(1);

	return result[0] || null;
};

export const getDomainProjectHandler = async (params: {
	ctx: z.infer<typeof getDomainProjectContextSchema>;
	clerkOrganizationId: string;
}) => {
	return getDomainProjectAction(params);
};
