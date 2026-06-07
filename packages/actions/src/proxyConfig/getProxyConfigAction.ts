import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { baseActionContextSchema } from "../context";
import {
	proxyConfigSelectSchema,
	proxyConfigTable,
	domainProjectTable,
} from "@opencited/db";

export const getProxyConfigInputSchema = z.object({});
export const getProxyConfigOutputSchema = proxyConfigSelectSchema.nullable();
export const getProxyConfigContextSchema = baseActionContextSchema;

export const getProxyConfigAction = async (params: {
	input: z.infer<typeof getProxyConfigInputSchema>;
	ctx: z.infer<typeof getProxyConfigContextSchema>;
	clerkOrganizationId: string;
}) => {
	const { ctx, clerkOrganizationId } = params;

	const domainProject = await ctx.db
		.select({ id: domainProjectTable.id })
		.from(domainProjectTable)
		.where(eq(domainProjectTable.clerkOrganizationId, clerkOrganizationId));

	if (!domainProject[0]) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Domain project not found",
		});
	}

	const result = await ctx.db
		.select()
		.from(proxyConfigTable)
		.where(eq(proxyConfigTable.domainProjectId, domainProject[0].id));

	return result[0] ?? null;
};

export const getProxyConfigHandler = async (params: {
	input: z.infer<typeof getProxyConfigInputSchema>;
	ctx: z.infer<typeof getProxyConfigContextSchema>;
	clerkOrganizationId: string;
}) => {
	return getProxyConfigAction(params);
};
