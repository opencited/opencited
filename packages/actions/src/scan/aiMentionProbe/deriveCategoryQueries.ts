import { generateObject } from "ai";
import { z } from "zod";
import { createProvider } from "../../ai/provider";
import type { CategoryQueryDeriver, HomepageSnapshot } from "./types";

const querySchema = z.object({
	queries: z.array(z.string().min(8).max(160)).max(3),
});

export function createCategoryQueryDeriver(): CategoryQueryDeriver {
	return async (snapshot: HomepageSnapshot, _domain: string) => {
		const { model, providerOptions } = createProvider();
		const context = [
			snapshot.title ? `Title: ${snapshot.title}` : null,
			snapshot.metaDescription
				? `Description: ${snapshot.metaDescription}`
				: null,
			snapshot.h1 ? `Headline: ${snapshot.h1}` : null,
			snapshot.brandName ? `Brand: ${snapshot.brandName}` : null,
			snapshot.textExcerpt
				? `Homepage excerpt: ${snapshot.textExcerpt.slice(0, 2000)}`
				: null,
		]
			.filter(Boolean)
			.join("\n");

		const { object } = await generateObject({
			model,
			providerOptions: providerOptions as any,
			schema: querySchema,
			maxOutputTokens: 200,
			abortSignal: AbortSignal.timeout(12_000),
			prompt: `You help test AI answer-engine visibility for a business website.

From the homepage context below, write exactly 3 short consumer search queries someone might ask an AI assistant when looking for this kind of product or service.

Rules:
- Describe the category or job-to-be-done, not a specific brand name.
- Do not include the business domain or brand name from the context.
- Each query should be a natural question or phrase (8–120 characters).

${context}`,
		});

		return object.queries;
	};
}
