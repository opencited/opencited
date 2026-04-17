import { eq } from "drizzle-orm";
import { z } from "zod";
import { baseActionContextSchema } from "../../trpc";
import { domainProjectSelectSchema, domainProjectTable } from "@opencited/db";

export const listDomainProjectInputSchema = z.object({});
export const listDomainProjectOutputSchema = domainProjectSelectSchema.array();
export const listDomainProjectContextSchema = baseActionContextSchema;

export const listDomainProjectAction = async (params: {
	ctx: z.infer<typeof listDomainProjectContextSchema>;
	clerkOrganizationId: string;
}) => {
	const { ctx, clerkOrganizationId } = params;

	const result = await ctx.db
		.select()
		.from(domainProjectTable)
		.where(eq(domainProjectTable.clerkOrganizationId, clerkOrganizationId));

	return result;
};

export const listDomainProjectHandler = async (params: {
	ctx: z.infer<typeof listDomainProjectContextSchema>;
	clerkOrganizationId: string;
}) => {
	return listDomainProjectAction(params);
};
