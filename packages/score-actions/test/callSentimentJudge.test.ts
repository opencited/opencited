import { describe, expect, it } from "bun:test";
import { callSentimentJudge, PROMPT_VERSION } from "../src";
import type { LLMCaller } from "../src";

const baseInput = {
	content: "MyBrand is the leading AEO platform.",
	brandName: "MyBrand",
	promptVersion: PROMPT_VERSION,
	modelName: "test-model",
};

function makeCall(responses: Array<string | Error>): LLMCaller & {
	calls: () => number;
} {
	const calls = { value: 0 };
	const fn = (() => {
		const i = calls.value;
		calls.value += 1;
		const r = responses[i];
		if (r instanceof Error) throw r;
		return Promise.resolve(r);
	}) as unknown as LLMCaller;
	return Object.assign(fn, { calls: () => calls.value });
}

describe("callSentimentJudge", () => {
	it("returns the parsed label on a successful first call", async () => {
		const call = makeCall(["positive"]);
		const result = await callSentimentJudge(baseInput, { call });
		expect(result.label).toBe("positive");
		expect(result.cacheHit).toBe(false);
		expect(result.fallback).toBe(false);
		expect(result.retryCount).toBe(0);
	});

	it("normalises the response (case, surrounding whitespace)", async () => {
		const call = makeCall(["  Neutral\n"]);
		const result = await callSentimentJudge(baseInput, { call });
		expect(result.label).toBe("neutral");
	});

	it("uses the cache on the second call with the same input", async () => {
		const cache = new Map();
		const call = makeCall(["positive"]);
		const first = await callSentimentJudge(baseInput, { call, cache });
		const second = await callSentimentJudge(baseInput, { call, cache });
		expect(first.label).toBe("positive");
		expect(first.cacheHit).toBe(false);
		expect(second.label).toBe("positive");
		expect(second.cacheHit).toBe(true);
	});

	it("does not share the cache across different brand names", async () => {
		const cache = new Map();
		const call = makeCall(["positive", "negative"]);
		const a = await callSentimentJudge(baseInput, { call, cache });
		const b = await callSentimentJudge(
			{ ...baseInput, brandName: "OtherBrand" },
			{ call, cache },
		);
		expect(a.label).toBe("positive");
		expect(b.label).toBe("negative");
	});

	it("retries once on a parse error, then falls back to neutral", async () => {
		const call = makeCall(["unsure", "still not parseable"]);
		const result = await callSentimentJudge(baseInput, {
			call,
			maxRetries: 1,
		});
		expect(result.label).toBeNull();
		expect(result.fallback).toBe(true);
		expect(result.retryCount).toBe(1);
	});

	it("retries once on a thrown error, then falls back to neutral when the retry also fails", async () => {
		const call = makeCall([
			new Error("upstream timeout"),
			new Error("still down"),
		]);
		const result = await callSentimentJudge(baseInput, { call, maxRetries: 1 });
		expect(result.label).toBeNull();
		expect(result.fallback).toBe(true);
		expect(result.retryCount).toBe(1);
	});

	it("succeeds on the retry when the second call returns a valid label", async () => {
		const call = makeCall([new Error("transient"), "negative"]);
		const result = await callSentimentJudge(baseInput, { call, maxRetries: 1 });
		expect(result.label).toBe("negative");
		expect(result.fallback).toBe(false);
		expect(result.retryCount).toBe(1);
	});

	it("falls back when the call times out", async () => {
		const slow = (() => new Promise<string>(() => {})) as unknown as LLMCaller;
		const result = await callSentimentJudge(baseInput, {
			call: slow,
			timeoutMs: 5,
			maxRetries: 0,
		});
		expect(result.label).toBeNull();
		expect(result.fallback).toBe(true);
		expect(result.retryCount).toBe(0);
	});

	it("respects maxRetries=0 (no retry on parse error)", async () => {
		const call = makeCall(["junk"]);
		const result = await callSentimentJudge(baseInput, {
			call,
			maxRetries: 0,
		});
		expect(result.label).toBeNull();
		expect(result.fallback).toBe(true);
		expect(result.retryCount).toBe(0);
	});
});
