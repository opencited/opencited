import { describe, expect, it } from "bun:test";
import { getJobNameForProvider } from "@opencited/queue";
import { createProvider } from "@opencited/browser-crawler";

describe("chatgpt-crawl dispatch integration", () => {
	it("dispatchCrawlJob maps chatgpt to chatgpt-crawl job name", () => {
		expect(getJobNameForProvider("chatgpt")).toBe("chatgpt-crawl");
	});

	it("createProvider returns ChatGPTProvider for 'chatgpt'", () => {
		const provider = createProvider("chatgpt");
		expect(provider.name).toBe("chatgpt");
		expect(provider.requiresAuth).toBe(false);
	});

	it("createProvider returns PerplexityProvider for 'perplexity'", () => {
		const provider = createProvider("perplexity");
		expect(provider.name).toBe("perplexity");
		expect(provider.requiresAuth).toBe(false);
	});

	it("both providers implement classifyError", () => {
		const chatgpt = createProvider("chatgpt");
		const perplexity = createProvider("perplexity");

		const error = new Error("unknown failure");
		expect(chatgpt.classifyError(error)).toBe("unknown");
		expect(perplexity.classifyError(error)).toBe("unknown");
	});
});
