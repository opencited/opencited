import { describe, expect, it } from "bun:test";
import { getJobNameForProvider } from "../src/dispatch-crawl-job";
import type { CrawlProvider } from "@opencited/db";

describe("getJobNameForProvider", () => {
	it("maps 'perplexity' to 'perplexity-crawl'", () => {
		expect(getJobNameForProvider("perplexity")).toBe("perplexity-crawl");
	});

	it("maps 'chatgpt' to 'chatgpt-crawl'", () => {
		expect(getJobNameForProvider("chatgpt")).toBe("chatgpt-crawl");
	});

	it("throws for unknown provider", () => {
		expect(() => getJobNameForProvider("nonexistent" as CrawlProvider)).toThrow(
			Error,
		);
		expect(() => getJobNameForProvider("nonexistent" as CrawlProvider)).toThrow(
			"nonexistent",
		);
	});
});
