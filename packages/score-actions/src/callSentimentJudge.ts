import { generateText, Output } from "ai";
import type { LanguageModel } from "ai";
import { z } from "zod";
import { PROMPT_VERSION } from "./constants";
import { cacheKey } from "./computeVisibilityScore";
import type {
	SentimentJudgeInput,
	SentimentJudgeResult,
	SentimentLabel,
} from "./types";

const sentimentOutputSchema = z.object({
	label: z.enum(["positive", "neutral", "negative"]),
});

const SYSTEM_PROMPT = `You are a sentiment classifier. You will be given an AI-generated answer and a brand name. Determine the overall sentiment toward the brand in the answer and respond with a json object.`;

function buildUserPrompt(content: string, brandName: string): string {
	return `Brand: ${brandName}

Answer:
---
${content}
---

What is the overall sentiment toward ${brandName} in this answer? Respond with a json object containing label: "positive", "neutral", or "negative".`;
}

export interface SentimentJudgeOptions {
	model: LanguageModel;
	cache?: Map<string, SentimentJudgeResult>;
	timeoutMs?: number;
	maxRetries?: number;
	providerOptions?: Record<string, Record<string, unknown>>;
}

export async function callSentimentJudge(
	input: SentimentJudgeInput,
	options: SentimentJudgeOptions,
): Promise<SentimentJudgeResult> {
	const {
		model,
		cache,
		timeoutMs = 10_000,
		maxRetries = 1,
		providerOptions,
	} = options;
	const key = cacheKey({
		content: input.content,
		promptVersion: input.promptVersion,
		modelName: input.modelName,
		brandName: input.brandName,
	});

	if (cache?.has(key)) {
		const cached = cache.get(key);
		if (cached) {
			return { ...cached, cacheHit: true };
		}
	}

	let lastError: unknown = null;
	for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
		try {
			const result = await withTimeout(
				generateText({
					model,
					output: Output.object({ schema: sentimentOutputSchema }),
					system: SYSTEM_PROMPT,
					prompt: buildUserPrompt(input.content, input.brandName),
					temperature: 0,
					...(providerOptions
						? {
								// biome-ignore lint/suspicious/noExplicitAny: provider options shape varies by provider
								providerOptions: providerOptions as any,
							}
						: {}),
				}),
				timeoutMs,
			);

			const parsed = result.output;
			if (!parsed?.label) {
				console.log(
					`[sentiment] no structured output (attempt ${attempt + 1}/${maxRetries + 1})`,
				);
				lastError = new Error("No structured output from LLM");
				continue;
			}

			const label: SentimentLabel = parsed.label;
			const sentimentResult: SentimentJudgeResult = {
				label,
				cacheHit: false,
				fallback: false,
				retryCount: attempt,
			};
			cache?.set(key, sentimentResult);
			console.log(
				`[sentiment] parsed label: ${label} (attempt ${attempt + 1})`,
			);
			return sentimentResult;
		} catch (err) {
			console.log(
				`[sentiment] LLM call error (attempt ${attempt + 1}/${maxRetries + 1}):`,
				err instanceof Error ? err.message : String(err),
			);
			lastError = err;
		}
	}

	void lastError;
	console.log(
		`[sentiment] all ${maxRetries + 1} attempts failed, falling back to neutral`,
	);
	const fallback: SentimentJudgeResult = {
		label: null,
		cacheHit: false,
		fallback: true,
		retryCount: maxRetries,
	};
	return fallback;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(
			() => reject(new Error(`LLM call exceeded ${ms}ms`)),
			ms,
		);
		promise.then(
			(value) => {
				clearTimeout(timer);
				resolve(value);
			},
			(err) => {
				clearTimeout(timer);
				reject(err);
			},
		);
	});
}

export { PROMPT_VERSION };
