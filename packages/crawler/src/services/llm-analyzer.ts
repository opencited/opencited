import { z } from "zod";
import { generateText, Output } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

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

interface LLMProviderConfig {
	baseURL: string;
	apiKey?: string;
	model: string;
}

function getProviderConfig(): LLMProviderConfig {
	const provider = process.env.LLM_PROVIDER;
	const baseURL = process.env.LLM_BASE_URL ?? "https://api.openai.com/v1";
	const apiKey = process.env.LLM_API_KEY;
	const model = process.env.LLM_MODEL;

	if (!model) {
		throw new Error(
			"LLM_MODEL environment variable is required. Please set it to your model identifier (e.g., 'llama3', 'local-model', 'gpt-4o-mini').",
		);
	}

	if (provider && provider !== "openai-compatible") {
		throw new Error(
			`Unsupported LLM provider: ${provider}. Currently only 'openai-compatible' is supported.`,
		);
	}

	return { baseURL, apiKey, model };
}

function createProvider() {
	const config = getProviderConfig();

	const provider = createOpenAI({
		baseURL: config.baseURL,
		apiKey: config.apiKey,
	});

	return provider(config.model);
}

export async function analyzeWithLLM(
	text: string,
): Promise<LLMInsights | null> {
	// Truncate to ~8000 characters to stay within typical local LLM context limits
	const truncatedText = text.slice(0, 8000);

	try {
		const model = createProvider();

		const result = await generateText({
			model,
			output: Output.object({
				schema: pageAnalysisSchema,
			}),
			prompt: `You are an AI assistant that analyzes web page content. Your task is to extract specific insights and return them in a structured JSON format.

You MUST return a JSON object with EXACTLY these fields:
{
  "tone": "Professional" | "Casual" | "Technical" | "Conversational" | "Neutral",
  "sentiment": "Positive" | "Negative" | "Neutral",
  "sentimentScore": number (1-100),
  "subjectivity": "Factual" | "Opinion" | "Mixed" | "Promotional",
  "perceivedPageType": "News article" | "Opinion" | "Listicle" | "How-to" | "Review" | "Comparison" | "Case study" | "Interview" | "Video" | "Podcast" | "Infographic" | "Research paper" | "Report" | "Documentation" | "Wiki" | "Product page" | "Landing page" | "Forum post" | "Social post" | "Comment" | "Q&A" | "Press release" | "FAQ" | "Glossary" | "Other",
  "perceivedIntent": "Informational" | "Transactional" | "Navigational" | "Commercial investigation",
  "perceivedAudience": "B2B" | "B2C" | "Both" | "Internal" | "Unknown",
  "namedEntities": [{"type": "Person" | "Organization" | "Location" | "Product" | "Event" | "Date" | "Money" | "Percent" | "Technology" | "Brand" | "Other", "name": "string"}] (max 50 entities),
  "verbTense": "Past" | "Present" | "Future"
}

IMPORTANT:
- Return ONLY the raw JSON object. Do NOT wrap it in markdown code blocks.
- Do NOT use triple backticks.
- Do NOT add any explanations or additional fields.
- Use EXACTLY the field names shown above.
- Choose values ONLY from the options listed for each field.

Content to analyze:
---
${truncatedText}
---`,
			maxOutputTokens: 2000,
		});

		return result.output;
	} catch (error) {
		console.warn(
			"LLM analysis failed:",
			error instanceof Error ? error.message : String(error),
		);
		console.warn("Continuing without LLM insights...");
		return null;
	}
}
