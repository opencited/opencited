import { eq } from "drizzle-orm";
import { z } from "zod";
import { baseActionContextSchema } from "../context";
import {
	promptQueryTable,
	domainProjectTable,
	competitorTable,
} from "@opencited/db";

export const getCrawlContextInputSchema = z.object({
	promptQueryId: z.string().min(1),
});

export const crawlContextSchema = z.object({
	domainProjectId: z.string().optional(),
	targetBrand: z.string().optional(),
	targetDomain: z.string().optional(),
	targetAliases: z.array(z.string()).default([]),
	knownCompetitors: z.array(
		z.object({
			name: z.string(),
			domain: z.string(),
		}),
	),
});

export const getCrawlContextOutputSchema = crawlContextSchema;

export const getCrawlContextContextSchema = baseActionContextSchema;

export const getCrawlContextAction = async (params: {
	input: z.infer<typeof getCrawlContextInputSchema>;
	ctx: z.infer<typeof getCrawlContextContextSchema>;
}) => {
	const { input, ctx } = params;

	const promptQuery = await ctx.db
		.select()
		.from(promptQueryTable)
		.where(eq(promptQueryTable.id, input.promptQueryId))
		.limit(1);

	const domainProjectId = promptQuery[0]?.domainProjectId ?? undefined;

	let targetBrand: string | undefined;
	let targetDomain: string | undefined;
	let targetAliases: string[] = [];
	let knownCompetitors: Array<{ name: string; domain: string }> = [];

	if (domainProjectId) {
		const domainProject = await ctx.db
			.select()
			.from(domainProjectTable)
			.where(eq(domainProjectTable.id, domainProjectId))
			.limit(1);

		targetBrand = domainProject[0]?.name ?? undefined;
		targetDomain = domainProject[0]?.domain ?? undefined;
		targetAliases = (domainProject[0]?.aliases as string[]) ?? [];

		const competitors = await ctx.db
			.select()
			.from(competitorTable)
			.where(eq(competitorTable.domainProjectId, domainProjectId));

		knownCompetitors = competitors.map(
			(c: { name: string; domain: string }) => ({
				name: c.name,
				domain: c.domain,
			}),
		);
	}

	return {
		domainProjectId,
		targetBrand,
		targetDomain,
		targetAliases,
		knownCompetitors,
	};
};

export const getCrawlContextHandler = async (params: {
	input: z.infer<typeof getCrawlContextInputSchema>;
	ctx: z.infer<typeof getCrawlContextContextSchema>;
}) => {
	return getCrawlContextAction(params);
};
