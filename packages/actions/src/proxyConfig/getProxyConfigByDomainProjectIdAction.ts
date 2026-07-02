import { eq } from "drizzle-orm";
import { z } from "zod";
import { baseActionContextSchema } from "../context";
import { proxyConfigSelectSchema, proxyConfigTable } from "@opencited/db";

export const getProxyConfigByDomainProjectIdInputSchema = z.object({
	domainProjectId: z.string().min(1),
});

export const getProxyConfigByDomainProjectIdOutputSchema =
	proxyConfigSelectSchema.nullable();

export const getProxyConfigByDomainProjectIdContextSchema =
	baseActionContextSchema;

export const getProxyConfigByDomainProjectIdAction = async (params: {
	input: z.infer<typeof getProxyConfigByDomainProjectIdInputSchema>;
	ctx: z.infer<typeof getProxyConfigByDomainProjectIdContextSchema>;
}) => {
	const { input, ctx } = params;

	const result = await ctx.db
		.select()
		.from(proxyConfigTable)
		.where(eq(proxyConfigTable.domainProjectId, input.domainProjectId));

	return result[0] ?? null;
};

export const getProxyConfigByDomainProjectIdHandler = async (params: {
	input: z.infer<typeof getProxyConfigByDomainProjectIdInputSchema>;
	ctx: z.infer<typeof getProxyConfigByDomainProjectIdContextSchema>;
}) => {
	return getProxyConfigByDomainProjectIdAction(params);
};
