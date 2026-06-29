import { eq } from "drizzle-orm";
import { z } from "zod";
import { baseActionContextSchema } from "../context";
import {
	crawlReferenceTable,
	promptQueryCrawlTable,
	promptQueryTable,
	domainProjectTable,
	competitorTable,
} from "@opencited/db";

export const inlineLinkSchema = z.object({
	title: z.string().min(1),
	url: z.string().url(),
	domain: z.string().min(1),
	position: z.number().int(),
});

export const saveInlineLinksInputSchema = z.object({
	crawlId: z.string().min(1, "Crawl ID is required"),
	promptQueryId: z.string().min(1, "Prompt query is required"),
	domainProjectId: z.string().optional(),
	inlineLinks: z.array(inlineLinkSchema),
});

export const saveInlineLinksOutputSchema = z.object({
	linksSaved: z.number(),
});

export const saveInlineLinksContextSchema = baseActionContextSchema;

export const saveInlineLinksAction = async (params: {
	input: z.infer<typeof saveInlineLinksInputSchema>;
	ctx: z.infer<typeof saveInlineLinksContextSchema>;
}) => {
	const { input, ctx } = params;
	const { crawlId, promptQueryId, domainProjectId, inlineLinks } = input;

	if (inlineLinks.length === 0) {
		return { linksSaved: 0 };
	}

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

	const rowsToInsert = inlineLinks.map((link) => ({
		crawlId,
		kind: "inline-link" as const,
		domain: link.domain,
		url: link.url,
		title: link.title,
		position: link.position,
		isOwnDomain:
			ownDomain && link.domain.toLowerCase() === ownDomain ? "true" : "false",
		isCompetitorDomain: competitorDomains.has(link.domain.toLowerCase())
			? "true"
			: "false",
	}));

	await ctx.db.insert(crawlReferenceTable).values(rowsToInsert);

	return { linksSaved: rowsToInsert.length };
};

export const saveInlineLinksHandler = async (params: {
	input: z.infer<typeof saveInlineLinksInputSchema>;
	ctx: z.infer<typeof saveInlineLinksContextSchema>;
}) => {
	return saveInlineLinksAction(params);
};
