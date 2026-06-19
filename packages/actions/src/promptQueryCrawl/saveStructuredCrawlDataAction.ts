import { eq } from "drizzle-orm";
import { z } from "zod";
import { baseActionContextSchema } from "../context";
import {
	crawlSourceTable,
	crawlBrandMentionTable,
	promptQueryCrawlTable,
	promptQueryTable,
	domainProjectTable,
	competitorTable,
} from "@opencited/db";

export const citationSourceSchema = z.object({
	domain: z.string().min(1),
	url: z.string().url(),
	title: z.string().optional(),
	description: z.string().optional(),
	position: z.number().int(),
	favicon: z.string().optional(),
	sourceName: z.string().optional(),
});

export const brandMentionSchema = z.object({
	brandName: z.string().min(1),
	context: z.string().min(1),
	brandUrl: z.string().optional(),
});

export const structuredCrawlDataSchema = z.object({
	citations: z.array(citationSourceSchema),
	brandMentions: z.array(brandMentionSchema),
	answerFormat: z.string().optional(),
	wordCount: z.number().int().optional(),
});

export const saveStructuredCrawlDataInputSchema = z.object({
	crawlId: z.string().min(1, "Crawl ID is required"),
	promptQueryId: z.string().min(1, "Prompt query is required"),
	domainProjectId: z.string().optional(),
	structured: structuredCrawlDataSchema,
});

export const saveStructuredCrawlDataOutputSchema = z.object({
	sourcesSaved: z.number(),
	mentionsSaved: z.number(),
});

export const saveStructuredCrawlDataContextSchema = baseActionContextSchema;

export const saveStructuredCrawlDataAction = async (params: {
	input: z.infer<typeof saveStructuredCrawlDataInputSchema>;
	ctx: z.infer<typeof saveStructuredCrawlDataContextSchema>;
}) => {
	const { input, ctx } = params;

	const { crawlId, promptQueryId, domainProjectId, structured } = input;

	const crawlRecord = await ctx.db
		.select()
		.from(promptQueryCrawlTable)
		.where(eq(promptQueryCrawlTable.id, crawlId))
		.limit(1);

	if (!crawlRecord[0]) {
		throw new Error("Crawl record not found");
	}

	const promptQuery = await ctx.db
		.select()
		.from(promptQueryTable)
		.where(eq(promptQueryTable.id, promptQueryId))
		.limit(1);

	const effectiveDomainProjectId =
		domainProjectId ?? promptQuery?.[0]?.domainProjectId;

	const competitors = effectiveDomainProjectId
		? await ctx.db
				.select()
				.from(competitorTable)
				.where(eq(competitorTable.domainProjectId, effectiveDomainProjectId))
		: [];

	const competitorDomains = new Set(
		competitors.map((c: { domain: string }) => c.domain.toLowerCase()),
	);

	const ownDomain = effectiveDomainProjectId
		? (
				await ctx.db
					.select()
					.from(domainProjectTable)
					.where(eq(domainProjectTable.id, effectiveDomainProjectId))
			)[0]?.domain?.toLowerCase()
		: undefined;

	const sourcesToInsert = structured.citations.map((citation) => ({
		crawlId,
		domain: citation.domain,
		url: citation.url,
		title: citation.title,
		description: citation.description,
		position: citation.position,
		isOwnDomain:
			ownDomain && citation.domain.toLowerCase() === ownDomain
				? "true"
				: "false",
		isCompetitorDomain: competitorDomains.has(citation.domain.toLowerCase())
			? "true"
			: "false",
		metadata: citation.sourceName
			? {
					sourceName: citation.sourceName,
					favicon: citation.favicon,
				}
			: undefined,
	}));

	if (sourcesToInsert.length > 0) {
		await ctx.db.insert(crawlSourceTable).values(sourcesToInsert);
	}

	const mentionsToInsert = structured.brandMentions.map((mention) => ({
		crawlId,
		brandName: mention.brandName,
		context: mention.context,
		brandUrl: mention.brandUrl,
		mentionType: "other" as const,
		metadata: {},
	}));

	if (mentionsToInsert.length > 0) {
		await ctx.db.insert(crawlBrandMentionTable).values(mentionsToInsert);
	}

	const updateData: Record<string, unknown> = {};

	if (structured.citations.length > 0) {
		updateData.sourceCount = structured.citations.length;
	}

	if (structured.brandMentions.length > 0) {
		updateData.brandMentionCount = structured.brandMentions.length;
	}

	if (structured.answerFormat) {
		updateData.answerFormat = structured.answerFormat;
	}

	if (structured.wordCount) {
		updateData.wordCount = structured.wordCount;
	}

	if (effectiveDomainProjectId) {
		updateData.domainProjectId = effectiveDomainProjectId;
	}

	if (Object.keys(updateData).length > 0) {
		await ctx.db
			.update(promptQueryCrawlTable)
			.set(updateData)
			.where(eq(promptQueryCrawlTable.id, crawlId));
	}

	return {
		sourcesSaved: sourcesToInsert.length,
		mentionsSaved: mentionsToInsert.length,
	};
};

export const saveStructuredCrawlDataHandler = async (params: {
	input: z.infer<typeof saveStructuredCrawlDataInputSchema>;
	ctx: z.infer<typeof saveStructuredCrawlDataContextSchema>;
}) => {
	return saveStructuredCrawlDataAction(params);
};
