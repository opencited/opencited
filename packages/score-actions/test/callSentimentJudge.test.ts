import { describe, expect, it } from "bun:test";
import { callSentimentJudge, PROMPT_VERSION } from "../src";
import type { SentimentJudgeResult } from "../src";
import { MockLanguageModelV3 } from "ai/test";
import type { LanguageModel } from "ai";

const baseInput = {
	content: "MyBrand is the leading AEO platform.",
	brandName: "MyBrand",
	promptVersion: PROMPT_VERSION,
	modelName: "test-model",
};

function makeMockModel(response: string | Error): LanguageModel {
	return new MockLanguageModelV3({
		doGenerate: async () => {
			if (response instanceof Error) throw response;
			return {
				content: [{ type: "text", text: response }],
				finishReason: { unified: "stop", raw: undefined },
				usage: {
					inputTokens: {
						total: 10,
						noCache: 10,
						cacheRead: undefined,
						cacheWrite: undefined,
					},
					outputTokens: { total: 20, text: 20, reasoning: undefined },
				},
				warnings: [],
			};
		},
	});
}

describe("callSentimentJudge", () => {
	it("returns the parsed label on a successful first call", async () => {
		const model = makeMockModel('{"label":"positive"}');
		const result = await callSentimentJudge(baseInput, { model });
		expect(result.label).toBe("positive");
		expect(result.cacheHit).toBe(false);
		expect(result.fallback).toBe(false);
		expect(result.retryCount).toBe(0);
	});

	it("returns negative sentiment", async () => {
		const model = makeMockModel('{"label":"negative"}');
		const result = await callSentimentJudge(baseInput, { model });
		expect(result.label).toBe("negative");
		expect(result.fallback).toBe(false);
	});

	it("returns neutral sentiment", async () => {
		const model = makeMockModel('{"label":"neutral"}');
		const result = await callSentimentJudge(baseInput, { model });
		expect(result.label).toBe("neutral");
		expect(result.fallback).toBe(false);
	});

	it("uses the cache on the second call with the same input", async () => {
		const cache = new Map<string, SentimentJudgeResult>();
		const model = makeMockModel('{"label":"positive"}');
		const first = await callSentimentJudge(baseInput, { model, cache });
		const second = await callSentimentJudge(baseInput, { model, cache });
		expect(first.label).toBe("positive");
		expect(first.cacheHit).toBe(false);
		expect(second.label).toBe("positive");
		expect(second.cacheHit).toBe(true);
	});

	it("does not share the cache across different brand names", async () => {
		const cache = new Map<string, SentimentJudgeResult>();
		let callCount = 0;
		const model = new MockLanguageModelV3({
			doGenerate: async () => {
				callCount++;
				const label = callCount === 1 ? "positive" : "negative";
				return {
					content: [{ type: "text", text: `{"label":"${label}"}` }],
					finishReason: { unified: "stop", raw: undefined },
					usage: {
						inputTokens: {
							total: 10,
							noCache: 10,
							cacheRead: undefined,
							cacheWrite: undefined,
						},
						outputTokens: { total: 20, text: 20, reasoning: undefined },
					},
					warnings: [],
				};
			},
		});
		const a = await callSentimentJudge(baseInput, { model, cache });
		const b = await callSentimentJudge(
			{ ...baseInput, brandName: "OtherBrand" },
			{ model, cache },
		);
		expect(a.label).toBe("positive");
		expect(b.label).toBe("negative");
	});

	it("retries once on a thrown error, then falls back to neutral when the retry also fails", async () => {
		const model = makeMockModel(new Error("upstream timeout"));
		const result = await callSentimentJudge(baseInput, {
			model,
			maxRetries: 1,
		});
		expect(result.label).toBeNull();
		expect(result.fallback).toBe(true);
		expect(result.retryCount).toBe(1);
	});

	it("succeeds on the retry when the second call returns a valid label", async () => {
		let callCount = 0;
		const model = new MockLanguageModelV3({
			doGenerate: async () => {
				callCount++;
				if (callCount === 1) throw new Error("transient");
				return {
					content: [{ type: "text", text: '{"label":"negative"}' }],
					finishReason: { unified: "stop", raw: undefined },
					usage: {
						inputTokens: {
							total: 10,
							noCache: 10,
							cacheRead: undefined,
							cacheWrite: undefined,
						},
						outputTokens: { total: 20, text: 20, reasoning: undefined },
					},
					warnings: [],
				};
			},
		});
		const result = await callSentimentJudge(baseInput, {
			model,
			maxRetries: 1,
		});
		expect(result.label).toBe("negative");
		expect(result.fallback).toBe(false);
		expect(result.retryCount).toBe(1);
	});

	it("falls back when the call times out", async () => {
		const model = new MockLanguageModelV3({
			doGenerate: async () => {
				await new Promise((r) => setTimeout(r, 5000));
				return {
					content: [{ type: "text", text: '{"label":"positive"}' }],
					finishReason: { unified: "stop", raw: undefined },
					usage: {
						inputTokens: {
							total: 10,
							noCache: 10,
							cacheRead: undefined,
							cacheWrite: undefined,
						},
						outputTokens: { total: 20, text: 20, reasoning: undefined },
					},
					warnings: [],
				};
			},
		});
		const result = await callSentimentJudge(baseInput, {
			model,
			timeoutMs: 5,
			maxRetries: 0,
		});
		expect(result.label).toBeNull();
		expect(result.fallback).toBe(true);
		expect(result.retryCount).toBe(0);
	});

	it("respects maxRetries=0 (no retry on error)", async () => {
		const model = makeMockModel(new Error("fail"));
		const result = await callSentimentJudge(baseInput, {
			model,
			maxRetries: 0,
		});
		expect(result.label).toBeNull();
		expect(result.fallback).toBe(true);
		expect(result.retryCount).toBe(0);
	});
});
