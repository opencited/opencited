import { PROMPT_VERSION } from "./constants";
import { cacheKey } from "./computeVisibilityScore";
import type {
	LLMCaller,
	SentimentJudgeInput,
	SentimentJudgeResult,
	SentimentLabel,
} from "./types";

const SYSTEM_PROMPT = `You are a sentiment classifier. You will be given an AI-generated answer and a brand name. Respond with exactly one word: positive, neutral, or negative. Do not add any other text.`;

function buildUserPrompt(content: string, brandName: string): string {
	return `Brand: ${brandName}

Answer:
---
${content}
---

What is the overall sentiment toward ${brandName} in this answer? Respond with exactly one of: positive, neutral, negative`;
}

function parseLabel(raw: string): SentimentLabel | null {
	const normalised = raw.trim().toLowerCase();
	if (
		normalised === "positive" ||
		normalised === "neutral" ||
		normalised === "negative"
	) {
		return normalised;
	}
	const compact = normalised.replace(/[^a-z]/g, "");
	if (
		compact === "positive" ||
		compact === "neutral" ||
		compact === "negative"
	) {
		return compact;
	}
	return null;
}

export interface SentimentJudgeOptions {
	call: LLMCaller;
	cache?: Map<string, SentimentJudgeResult>;
	timeoutMs?: number;
	maxRetries?: number;
}

export async function callSentimentJudge(
	input: SentimentJudgeInput,
	options: SentimentJudgeOptions,
): Promise<SentimentJudgeResult> {
	const { call, cache, timeoutMs = 10_000, maxRetries = 1 } = options;
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
			const raw = await withTimeout(
				call({
					systemPrompt: SYSTEM_PROMPT,
					userPrompt: buildUserPrompt(input.content, input.brandName),
				}),
				timeoutMs,
			);
			const label = parseLabel(raw);
			if (label === null) {
				lastError = new Error(
					`Unparseable sentiment response: ${raw.slice(0, 64)}`,
				);
				continue;
			}
			const result: SentimentJudgeResult = {
				label,
				cacheHit: false,
				fallback: false,
				retryCount: attempt,
			};
			cache?.set(key, result);
			return result;
		} catch (err) {
			lastError = err;
		}
	}

	void lastError;
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
