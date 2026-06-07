import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import type { z } from "zod";
import { baseActionContextSchema } from "../context";
import {
	proxyConfigInsertSchema,
	proxyConfigSelectSchema,
	proxyConfigTable,
	domainProjectTable,
} from "@opencited/db";

export const createProxyConfigInputSchema = proxyConfigInsertSchema;
export const createProxyConfigOutputSchema = proxyConfigSelectSchema;
export const createProxyConfigContextSchema = baseActionContextSchema;

export const createProxyConfigAction = async (params: {
	input: z.infer<typeof createProxyConfigInputSchema>;
	ctx: z.infer<typeof createProxyConfigContextSchema>;
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

	const existing = await ctx.db
		.select({ id: proxyConfigTable.id })
		.from(proxyConfigTable)
		.where(eq(proxyConfigTable.domainProjectId, domainProject[0].id));

	if (existing[0]) {
		throw new TRPCError({
			code: "CONFLICT",
			message: "Proxy config already exists for this domain project",
		});
	}

	const result = await ctx.db
		.insert(proxyConfigTable)
		.values({
			domainProjectId: domainProject[0].id,
			sourceType: input.sourceType,
			sourceValue: input.sourceValue,
			enabled: input.enabled ?? false,
		})
		.returning();

	if (!result[0]) {
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: "Failed to create proxy config",
		});
	}

	return result[0];
};

export const createProxyConfigHandler = async (params: {
	input: z.infer<typeof createProxyConfigInputSchema>;
	ctx: z.infer<typeof createProxyConfigContextSchema>;
	clerkOrganizationId: string;
}) => {
	return createProxyConfigAction(params);
};
