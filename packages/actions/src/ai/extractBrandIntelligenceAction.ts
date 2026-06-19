import { z } from "zod";
import { generateText, Output } from "ai";
import { createProvider } from "./provider";

export const extractBrandIntelligenceInputSchema = z.object({
	content: z.string().min(1, "Content is required"),
	query: z.string().min(1, "Query is required"),
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

export const aiBrandMentionSchema = z.object({
	brandName: z.string().min(1),
	brandUrl: z.string().nullable().optional(),
	context: z.string().min(1),
	mentionType: z.enum(["target", "competitor", "other"]),
});

export const discoveredCompetitorSchema = z.object({
	name: z.string().min(1),
	domain: z.string().min(1),
});

export const extractBrandIntelligenceOutputSchema = z.object({
	brandMentions: z.array(aiBrandMentionSchema),
	discoveredCompetitors: z.array(discoveredCompetitorSchema),
	answerFormat: z.enum([
		"numbered_list",
		"paragraph",
		"comparison_table",
		"conversational",
		"unknown",
	]),
});

export type ExtractBrandIntelligenceInput = z.infer<
	typeof extractBrandIntelligenceInputSchema
>;
export type ExtractBrandIntelligenceOutput = z.infer<
	typeof extractBrandIntelligenceOutputSchema
>;

const SYSTEM_PROMPT = `You are an AI competitive intelligence analyst. Your job is to analyze AI-generated responses and extract brand mentions with precise classification.

Rules:
- Be precise with brand names. Extract the actual brand/company name, not generic terms.
- "target" = the brand the user is tracking (their own brand). If a brand name, domain, or alias matches the target, classify it as "target".
- "competitor" = any brand that competes with the target in the context of this query
- "other" = brands mentioned that are not competitors (e.g., platforms, tools, infrastructure)
- For brandUrl, extract from context if available, or infer the most likely domain (e.g., "Clerk" → "clerk.com")
- Do NOT include generic terms like "OAuth", "MFA", "API", "Next.js" as brands
- Do NOT include the query itself or section headings as brands
- Only include brands that are actually mentioned in the content

CRITICAL: discoveredCompetitors must include EVERY brand you classified as "competitor" that is NOT in the known competitors list provided below. This is how new competitors are discovered. Do NOT omit them.

CRITICAL: For domain fields, NEVER return null. If no URL is mentioned, infer the most likely domain (e.g., "Auth0" → "auth0.com", "Supabase Auth" → "supabase.com", "Firebase Authentication" → "firebase.google.com"). Always return a string.`;

function buildUserPrompt(
	input: z.infer<typeof extractBrandIntelligenceInputSchema>,
): string {
	const knownCompetitorsList =
		input.knownCompetitors.length > 0
			? input.knownCompetitors
					.map((c) => `- ${c.name} (${c.domain})`)
					.join("\n")
			: "(none)";

	const targetBrand = input.targetBrand ?? "(not specified)";
	const targetDomain = input.targetDomain ?? "(not specified)";
	const targetAliases =
		input.targetAliases.length > 0
			? input.targetAliases.map((a) => `- ${a}`).join("\n")
			: "(none)";

	return `Analyze the following AI response to the query: "${input.query}"

Target brand being tracked:
- Name: ${targetBrand}
- Domain: ${targetDomain}
- Aliases/alternate names:
${targetAliases}

IMPORTANT: If a brand mention matches the target name, domain, or any alias, classify it as "target" — NOT "competitor".

Known competitors (do NOT include these in discoveredCompetitors):
${knownCompetitorsList}

---
CONTENT:
${input.content}
---

Return a JSON object with this exact structure:
{
  "brandMentions": [
    {
      "brandName": "string",
      "brandUrl": "string or null",
      "context": "the surrounding sentence or paragraph where the brand is mentioned",
      "mentionType": "target" | "competitor" | "other"
    }
  ],
  "discoveredCompetitors": [
    {
      "name": "EXACT brandName from brandMentions where mentionType is 'competitor' AND not in known list",
      "domain": "inferred or extracted domain"
    }
  ],
  "answerFormat": "numbered_list" | "paragraph" | "comparison_table" | "conversational" | "unknown"
}

IMPORTANT: For discoveredCompetitors, look at every brandMention with mentionType="competitor". If that brand is NOT in the known competitors list above, add it to discoveredCompetitors. This is critical for competitor discovery.

IMPORTANT: NEVER return null for domain fields. If no URL is mentioned in the content, infer the most likely domain (e.g., "Auth0" → "auth0.com", "Supabase Auth" → "supabase.com"). Always return a valid domain string.`;
}

export const extractBrandIntelligenceAction = async (
	input: z.infer<typeof extractBrandIntelligenceInputSchema>,
): Promise<z.infer<typeof extractBrandIntelligenceOutputSchema>> => {
	const prompt = buildUserPrompt(input);
	const { model, providerOptions } = createProvider();

	const result = await generateText({
		model,
		output: Output.object({
			schema: extractBrandIntelligenceOutputSchema,
		}),
		providerOptions: providerOptions as any,
		system: SYSTEM_PROMPT,
		prompt,
		temperature: 0.1,
		maxOutputTokens: 4000,
	});

	return result.output;
};
