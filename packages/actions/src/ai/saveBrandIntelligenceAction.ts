import { eq } from "drizzle-orm";
import { z } from "zod";
import { baseActionContextSchema } from "../context";
import {
	crawlBrandMentionTable,
	promptQueryCrawlTable,
	competitorTable,
} from "@opencited/db";
import { extractBrandIntelligenceOutputSchema } from "./extractBrandIntelligenceAction";

export const saveBrandIntelligenceInputSchema = z.object({
	crawlId: z.string().min(1),
	domainProjectId: z.string().optional(),
	intelligence: extractBrandIntelligenceOutputSchema,
});

export const saveBrandIntelligenceOutputSchema = z.object({
	mentionsSaved: z.number(),
	competitorsCreated: z.number(),
	competitorsMatched: z.number(),
});

export const saveBrandIntelligenceContextSchema = baseActionContextSchema;

export const saveBrandIntelligenceAction = async (params: {
	input: z.infer<typeof saveBrandIntelligenceInputSchema>;
	ctx: z.infer<typeof saveBrandIntelligenceContextSchema>;
}) => {
	const { input, ctx } = params;
	const { crawlId, domainProjectId, intelligence } = input;

	const existingCompetitors = domainProjectId
		? await ctx.db
				.select()
				.from(competitorTable)
				.where(eq(competitorTable.domainProjectId, domainProjectId))
		: [];

	const competitorByName = new Map<string, { id: string; domain: string }>();
	const competitorByDomain = new Map<string, { id: string; name: string }>();

	for (const c of existingCompetitors) {
		competitorByName.set(c.name.toLowerCase(), {
			id: c.id,
			domain: c.domain,
		});
		competitorByDomain.set(c.domain.toLowerCase(), {
			id: c.id,
			name: c.name,
		});
	}

	const createdCompetitorIds = new Map<string, string>();
	let competitorsCreated = 0;

	for (const discovered of intelligence.discoveredCompetitors) {
		const nameKey = discovered.name.toLowerCase();
		const domainKey = discovered.domain.toLowerCase();

		const existingByName = competitorByName.get(nameKey);
		if (existingByName) {
			createdCompetitorIds.set(nameKey, existingByName.id);
			continue;
		}

		const existingByDomain = competitorByDomain.get(domainKey);
		if (existingByDomain) {
			createdCompetitorIds.set(nameKey, existingByDomain.id);
			continue;
		}

		if (!domainProjectId) continue;

		const created = await ctx.db
			.insert(competitorTable)
			.values({
				domainProjectId,
				name: discovered.name,
				domain: discovered.domain,
			})
			.returning();

		if (created[0]) {
			createdCompetitorIds.set(nameKey, created[0].id);
			competitorByName.set(nameKey, {
				id: created[0].id,
				domain: discovered.domain,
			});
			competitorsCreated++;
		}
	}

	const mentionsToInsert = intelligence.brandMentions.map((mention) => {
		const nameKey = mention.brandName.toLowerCase();
		let competitorId: string | undefined;

		if (mention.mentionType === "competitor") {
			competitorId =
				createdCompetitorIds.get(nameKey) ??
				competitorByName.get(nameKey)?.id ??
				competitorByDomain.get(mention.brandUrl?.toLowerCase() ?? "")?.id;
		}

		return {
			crawlId,
			competitorId,
			brandName: mention.brandName,
			brandUrl: mention.brandUrl,
			context: mention.context,
			mentionType: mention.mentionType,
			metadata: {},
		};
	});

	let competitorsMatched = 0;
	for (const m of mentionsToInsert) {
		if (m.competitorId) competitorsMatched++;
	}

	if (mentionsToInsert.length > 0) {
		await ctx.db.insert(crawlBrandMentionTable).values(mentionsToInsert);
	}

	const updateData: Record<string, unknown> = {};

	if (intelligence.brandMentions.length > 0) {
		updateData.brandMentionCount = intelligence.brandMentions.length;
	}

	if (intelligence.answerFormat && intelligence.answerFormat !== "unknown") {
		updateData.answerFormat = intelligence.answerFormat;
	}

	if (Object.keys(updateData).length > 0) {
		await ctx.db
			.update(promptQueryCrawlTable)
			.set(updateData)
			.where(eq(promptQueryCrawlTable.id, crawlId));
	}

	return {
		mentionsSaved: mentionsToInsert.length,
		competitorsCreated,
		competitorsMatched,
	};
};

export const saveBrandIntelligenceHandler = async (params: {
	input: z.infer<typeof saveBrandIntelligenceInputSchema>;
	ctx: z.infer<typeof saveBrandIntelligenceContextSchema>;
}) => {
	return saveBrandIntelligenceAction(params);
};
