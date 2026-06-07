import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import type { z } from "zod";
import { baseActionContextSchema } from "../context";
import {
	proxyConfigSelectSchema,
	proxyConfigTable,
	proxyConfigUpdateSchema,
	domainProjectTable,
} from "@opencited/db";

export const updateProxyConfigInputSchema = proxyConfigUpdateSchema;
export const updateProxyConfigOutputSchema = proxyConfigSelectSchema;
export const updateProxyConfigContextSchema = baseActionContextSchema;

export const updateProxyConfigAction = async (params: {
	input: z.infer<typeof updateProxyConfigInputSchema>;
	ctx: z.infer<typeof updateProxyConfigContextSchema>;
	clerkOrganizationId: string;
}) => {
	const { input, ctx, clerkOrganizationId } = params;

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
		.update(proxyConfigTable)
		.set(input)
		.where(eq(proxyConfigTable.domainProjectId, domainProject[0].id))
		.returning();

	if (!result[0]) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Proxy config not found",
		});
	}

	return result[0];
};

export const updateProxyConfigHandler = async (params: {
	input: z.infer<typeof updateProxyConfigInputSchema>;
	ctx: z.infer<typeof updateProxyConfigContextSchema>;
	clerkOrganizationId: string;
}) => {
	return updateProxyConfigAction(params);
};
