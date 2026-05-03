import { z } from "zod";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";

export const toneEnum = z.enum([
	"Professional",
	"Casual",
	"Technical",
	"Conversational",
	"Neutral",
]);
export type Tone = z.infer<typeof toneEnum>;

export const sentimentEnum = z.enum(["Positive", "Negative", "Neutral"]);
export type Sentiment = z.infer<typeof sentimentEnum>;

export const subjectivityEnum = z.enum([
	"Factual",
	"Opinion",
	"Mixed",
	"Promotional",
]);
export type Subjectivity = z.infer<typeof subjectivityEnum>;

export const perceivedPageTypeEnum = z.enum([
	"News article",
	"Opinion",
	"Listicle",
	"How-to",
	"Review",
	"Comparison",
	"Case study",
	"Interview",
	"Video",
	"Podcast",
	"Infographic",
	"Research paper",
	"Report",
	"Documentation",
	"Wiki",
	"Product page",
	"Landing page",
	"Forum post",
	"Social post",
	"Comment",
	"Q&A",
	"Press release",
	"FAQ",
	"Glossary",
	"Other",
]);
export type PerceivedPageType = z.infer<typeof perceivedPageTypeEnum>;

export const perceivedIntentEnum = z.enum([
	"Informational",
	"Transactional",
	"Navigational",
	"Commercial investigation",
]);
export type PerceivedIntent = z.infer<typeof perceivedIntentEnum>;

export const perceivedAudienceEnum = z.enum([
	"B2B",
	"B2C",
	"Both",
	"Internal",
	"Unknown",
]);
export type PerceivedAudience = z.infer<typeof perceivedAudienceEnum>;

export const verbTenseEnum = z.enum(["Past", "Present", "Future"]);
export type VerbTense = z.infer<typeof verbTenseEnum>;

export const entityTypeEnum = z.enum([
	"Person",
	"Organization",
	"Location",
	"Product",
	"Event",
	"Date",
	"Money",
	"Percent",
	"Technology",
	"Brand",
	"Other",
]);

export const namedEntitySchema = z.object({
	type: entityTypeEnum,
	name: z.string(),
});
export type NamedEntity = z.infer<typeof namedEntitySchema>;

export const pageAnalysisSchema = z.object({
	tone: toneEnum,
	sentiment: sentimentEnum,
	sentimentScore: z.number().int().min(1).max(100),
	subjectivity: subjectivityEnum,
	perceivedPageType: perceivedPageTypeEnum,
	perceivedIntent: perceivedIntentEnum,
	perceivedAudience: perceivedAudienceEnum,
	namedEntities: z.array(namedEntitySchema).max(50),
	verbTense: verbTenseEnum,
});

export type LLMInsights = z.infer<typeof pageAnalysisSchema>;

export async function analyzeWithLLM(text: string): Promise<LLMInsights> {
	const truncatedText = text.slice(0, 100_000);

	const { object } = await generateObject<LLMInsights>({
		model: openai("gpt-4o-mini"),
		schema: pageAnalysisSchema,
		prompt: `Analyze the following web page content and extract structured insights. Return ONLY the JSON object matching the schema — no explanation, no markdown formatting.

Content to analyze:
---
${truncatedText}
---`,
		maxTokens: 2000,
	});

	return object;
}
