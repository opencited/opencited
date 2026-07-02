import { describe, expect, it, beforeEach } from "bun:test";

describe("parseRateLimits", () => {
	it("rejects malformed JSON", async () => {
		process.env.CRAWL_RATE_LIMITS = "not-json";
		const { parseRateLimits } = await import("../src/lib/rate-limit");
		expect(() => parseRateLimits()).toThrow();
	});

	it("rejects non-numeric RPS values", async () => {
		process.env.CRAWL_RATE_LIMITS = '{"perplexity":{"rps":"fast"}}';
		const { parseRateLimits } = await import("../src/lib/rate-limit");
		expect(() => parseRateLimits()).toThrow();
	});

	it("parses valid config correctly", async () => {
		process.env.CRAWL_RATE_LIMITS =
			'{"perplexity":{"rps":0.5},"chatgpt":{"rps":0.2}}';
		const { parseRateLimits } = await import("../src/lib/rate-limit");
		const config = parseRateLimits();
		expect(config).toEqual({
			perplexity: { rps: 0.5 },
			chatgpt: { rps: 0.2 },
		});
	});
});

describe("rateLimit", () => {
	beforeEach(() => {
		process.env.CRAWL_RATE_LIMITS = '{"perplexity":{"rps":0.5}}';
	});

	it("succeeds immediately on first call for a configured provider", async () => {
		const { rateLimit } = await import("../src/lib/rate-limit");

		const start = Date.now();
		await rateLimit("perplexity");
		const elapsed = Date.now() - start;

		expect(elapsed).toBeLessThan(100);
	});

	it("unconfigured provider returns immediately with no throttling", async () => {
		const { rateLimit, _resetBucketsForTesting } = await import(
			"../src/lib/rate-limit"
		);
		_resetBucketsForTesting();

		const start = Date.now();
		await rateLimit("unknown-provider");
		const elapsed = Date.now() - start;

		expect(elapsed).toBeLessThan(100);
	});

	it("second call within 2 seconds sleeps before returning", async () => {
		const { rateLimit, _resetBucketsForTesting } = await import(
			"../src/lib/rate-limit"
		);
		_resetBucketsForTesting();

		await rateLimit("perplexity");

		const start = Date.now();
		await rateLimit("perplexity");
		const elapsed = Date.now() - start;

		expect(elapsed).toBeGreaterThanOrEqual(1800);
	});
});
