import { describe, test, expect } from "bun:test";
import { callSentimentJudge } from "@opencited/score-actions";
import { groq } from "@ai-sdk/groq";
import { MockLanguageModelV3 } from "ai/test";
import { POSITIVE_CONTENT, NEGATIVE_CONTENT, TARGET_BRAND } from "./fixtures";

const isIntegration = !!process.env.RUN_INTEGRATION;

const realModel = groq("qwen/qwen3-32b");
const groqProviderOptions = {
	groq: { structuredOutputs: false, strictJsonSchema: false },
};

describe.skipIf(!isIntegration)(
	"callSentimentJudge — integration (real Groq LLM)",
	() => {
		test("returns positive sentiment for clearly positive content", async () => {
			const result = await callSentimentJudge(
				{
					content: POSITIVE_CONTENT,
					brandName: TARGET_BRAND.name,
					promptVersion: "v1.0.0",
					modelName: "qwen/qwen3-32b",
				},
				{
					model: realModel,
					cache: new Map(),
					timeoutMs: 60_000,
					providerOptions: groqProviderOptions,
				},
			);

			expect(result.label).toBe("positive");
			expect(result.fallback).toBe(false);
			expect(result.cacheHit).toBe(false);
		}, 90_000);

		test("returns negative sentiment for clearly negative content", async () => {
			const result = await callSentimentJudge(
				{
					content: NEGATIVE_CONTENT,
					brandName: TARGET_BRAND.name,
					promptVersion: "v1.0.0",
					modelName: "qwen/qwen3-32b",
				},
				{
					model: realModel,
					cache: new Map(),
					timeoutMs: 60_000,
					providerOptions: groqProviderOptions,
				},
			);

			expect(result.label).toBe("negative");
			expect(result.fallback).toBe(false);
		}, 90_000);

		test("caches result on second call with same input", async () => {
			const cache = new Map();
			const input = {
				content: POSITIVE_CONTENT,
				brandName: TARGET_BRAND.name,
				promptVersion: "v1.0.0",
				modelName: "qwen/qwen3-32b",
			};

			const first = await callSentimentJudge(input, {
				model: realModel,
				cache,
				timeoutMs: 60_000,
				providerOptions: groqProviderOptions,
			});
			expect(first.cacheHit).toBe(false);
			expect(first.fallback).toBe(false);

			const second = await callSentimentJudge(input, {
				model: realModel,
				cache,
				providerOptions: groqProviderOptions,
			});
			expect(second.cacheHit).toBe(true);
			expect(second.label).toBe(first.label);
		}, 120_000);

		test("returns fallback when LLM call times out", async () => {
			const slowModel = new MockLanguageModelV3({
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

			const result = await callSentimentJudge(
				{
					content: POSITIVE_CONTENT,
					brandName: TARGET_BRAND.name,
					promptVersion: "v1.0.0",
					modelName: "qwen/qwen3-32b",
				},
				{ model: slowModel, cache: new Map(), timeoutMs: 100 },
			);

			expect(result.fallback).toBe(true);
			expect(result.label).toBeNull();
		}, 30_000);
	},
);
