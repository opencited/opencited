import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { baseActionContextSchema } from "../context";
import { proxyConfigTable, domainProjectTable } from "@opencited/db";

export const deleteProxyConfigInputSchema = z.object({});
export const deleteProxyConfigOutputSchema = z.object({ success: z.boolean() });
export const deleteProxyConfigContextSchema = baseActionContextSchema;

export const deleteProxyConfigAction = async (params: {
	input: z.infer<typeof deleteProxyConfigInputSchema>;
	ctx: z.infer<typeof deleteProxyConfigContextSchema>;
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
		.delete(proxyConfigTable)
		.where(eq(proxyConfigTable.domainProjectId, domainProject[0].id))
		.returning();

	if (!result[0]) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Proxy config not found",
		});
	}

	return { success: true };
};

export const deleteProxyConfigHandler = async (params: {
	input: z.infer<typeof deleteProxyConfigInputSchema>;
	ctx: z.infer<typeof deleteProxyConfigContextSchema>;
	clerkOrganizationId: string;
}) => {
	return deleteProxyConfigAction(params);
};
