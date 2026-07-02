import { describe, expect, it } from "bun:test";
import {
	filterSelfCitations,
	PROVIDER_OWNED_DOMAINS,
} from "../src/providers/self-citation-filter";
import type { InlineLink } from "../src/providers/types";

describe("PROVIDER_OWNED_DOMAINS", () => {
	it("maps chatgpt to openai-owned domains", () => {
		expect(PROVIDER_OWNED_DOMAINS.chatgpt).toContain("chatgpt.com");
		expect(PROVIDER_OWNED_DOMAINS.chatgpt).toContain("openai.com");
	});

	it("maps perplexity to perplexity-owned domains", () => {
		expect(PROVIDER_OWNED_DOMAINS.perplexity).toContain("perplexity.ai");
	});
});

describe("filterSelfCitations", () => {
	it("drops links whose domain matches a provider-owned domain", () => {
		const links: InlineLink[] = [
			{
				title: "OpenAI",
				url: "https://openai.com/about",
				domain: "openai.com",
				position: 1,
			},
			{
				title: "Acme",
				url: "https://acme.com/article",
				domain: "acme.com",
				position: 2,
			},
		];

		const filtered = filterSelfCitations("chatgpt", links);

		expect(filtered).toHaveLength(1);
		expect(filtered[0]?.domain).toBe("acme.com");
	});

	it("drops links matching any owned domain in the list", () => {
		const links: InlineLink[] = [
			{
				title: "ChatGPT",
				url: "https://chatgpt.com/share",
				domain: "chatgpt.com",
				position: 1,
			},
			{
				title: "OpenAI",
				url: "https://openai.com/blog",
				domain: "openai.com",
				position: 2,
			},
			{
				title: "Acme",
				url: "https://acme.com/page",
				domain: "acme.com",
				position: 3,
			},
		];

		const filtered = filterSelfCitations("chatgpt", links);

		expect(filtered).toHaveLength(1);
		expect(filtered[0]?.domain).toBe("acme.com");
	});

	it("returns all links when provider has no owned domains", () => {
		const links: InlineLink[] = [
			{
				title: "Acme",
				url: "https://acme.com/a",
				domain: "acme.com",
				position: 1,
			},
			{
				title: "Beta",
				url: "https://beta.com/b",
				domain: "beta.com",
				position: 2,
			},
		];

		const filtered = filterSelfCitations("unknown-provider", links);

		expect(filtered).toHaveLength(2);
	});

	it("returns empty array when all links are self-citations", () => {
		const links: InlineLink[] = [
			{
				title: "OpenAI",
				url: "https://openai.com/1",
				domain: "openai.com",
				position: 1,
			},
			{
				title: "ChatGPT",
				url: "https://chatgpt.com/2",
				domain: "chatgpt.com",
				position: 2,
			},
		];

		const filtered = filterSelfCitations("chatgpt", links);

		expect(filtered).toHaveLength(0);
	});

	it("handles empty input", () => {
		const filtered = filterSelfCitations("chatgpt", []);

		expect(filtered).toHaveLength(0);
	});

	it("is case-insensitive when matching domains", () => {
		const links: InlineLink[] = [
			{
				title: "OpenAI",
				url: "https://OpenAI.com/page",
				domain: "OpenAI.com",
				position: 1,
			},
			{
				title: "Acme",
				url: "https://acme.com/page",
				domain: "acme.com",
				position: 2,
			},
		];

		const filtered = filterSelfCitations("chatgpt", links);

		expect(filtered).toHaveLength(1);
		expect(filtered[0]?.domain).toBe("acme.com");
	});
});
