import { describe, expect, it } from "bun:test";
import {
	FORMULA_VERSION,
	PROMPT_VERSION,
	computeVisibilityScore,
} from "../src";
import type { ComputeVisibilityScoreInput } from "../src";

const targetBrand = {
	name: "MyBrand",
	domain: "mybrand.com",
	aliases: ["MyBrand Inc"],
};

const positiveSentiment = {
	label: "positive" as const,
	cacheHit: false,
	fallback: false,
	retryCount: 0,
};

const neutralSentiment = {
	label: "neutral" as const,
	cacheHit: false,
	fallback: false,
	retryCount: 0,
};

describe("computeVisibilityScore — worked example", () => {
	it("matches the worked example from the spec (Crawl 1)", () => {
		const result = computeVisibilityScore({
			crawlContent: "answer body 1",
			crawlProvider: "perplexity",
			crawlCitations: [
				{
					domain: "acme.com",
					url: "https://acme.com/article",
					position: 1,
					isOwnDomain: false,
				},
				{
					domain: "beta.com",
					url: "https://beta.com/article",
					position: 2,
					isOwnDomain: false,
				},
			],
			brandMentions: [
				{
					brandName: "MyBrand",
					mentionType: "target",
					position: 1,
					brandUrl: "https://mybrand.com",
				},
				{ brandName: "Acme", mentionType: "competitor", position: 2 },
				{ brandName: "Beta", mentionType: "competitor", position: 3 },
				{ brandName: "SomeTool", mentionType: "other", position: 4 },
			],
			targetBrand,
			sentimentInput: {
				label: "positive",
				cacheHit: false,
				fallback: false,
				retryCount: 0,
			},
		});

		expect(result.mentionScore).toBe(100);
		expect(result.positionScore).toBe(100);
		expect(result.citationScore).toBe(0);
		expect(result.sentimentScore).toBe(100);
		expect(result.coMentionScore).toBe(25);
		expect(result.visibilityScore).toBe(73);
		expect(result.formulaVersion).toBe("v1.0.0");
		expect(result.computedAt).toBeInstanceOf(Date);
	});

	it("matches the worked example (Crawl 2: rank 3, cited, neutral)", () => {
		const result = computeVisibilityScore({
			crawlContent: "answer body 2",
			crawlProvider: "perplexity",
			crawlCitations: [
				{
					domain: "mybrand.com",
					url: "https://mybrand.com/article",
					position: 1,
					isOwnDomain: true,
				},
			],
			brandMentions: [
				{ brandName: "Acme", mentionType: "competitor", position: 1 },
				{ brandName: "Beta", mentionType: "competitor", position: 2 },
				{
					brandName: "MyBrand",
					mentionType: "target",
					position: 3,
					brandUrl: "https://mybrand.com",
				},
				{ brandName: "SomeTool", mentionType: "other", position: 4 },
			],
			targetBrand,
			sentimentInput: neutralSentiment,
		});

		expect(result.mentionScore).toBe(100);
		expect(result.positionScore).toBe(50);
		expect(result.citationScore).toBe(100);
		expect(result.sentimentScore).toBe(50);
		expect(result.coMentionScore).toBe(25);
		expect(result.visibilityScore).toBe(75);
	});

	it("matches the worked example (Crawl 3: rank 1, 2 of 4 mentions, neutral)", () => {
		const result = computeVisibilityScore({
			crawlContent: "answer body 3",
			crawlProvider: "perplexity",
			crawlCitations: [
				{
					domain: "acme.com",
					url: "https://acme.com/article",
					position: 1,
				},
			],
			brandMentions: [
				{
					brandName: "MyBrand",
					mentionType: "target",
					position: 1,
					brandUrl: "https://mybrand.com",
				},
				{
					brandName: "MyBrand",
					mentionType: "target",
					position: 3,
					brandUrl: "https://mybrand.com",
				},
				{ brandName: "Acme", mentionType: "competitor", position: 2 },
				{ brandName: "Beta", mentionType: "competitor", position: 4 },
			],
			targetBrand,
			sentimentInput: neutralSentiment,
		});

		expect(result.mentionScore).toBe(100);
		expect(result.positionScore).toBe(100);
		expect(result.citationScore).toBe(0);
		expect(result.sentimentScore).toBe(50);
		expect(result.coMentionScore).toBe(50);
		expect(result.visibilityScore).toBe(70);
	});
});

describe("computeVisibilityScore — edge cases", () => {
	it("returns 0 across the board when the target is not mentioned", () => {
		const result = computeVisibilityScore({
			crawlContent: "irrelevant answer",
			crawlProvider: "perplexity",
			crawlCitations: [],
			brandMentions: [
				{ brandName: "Acme", mentionType: "competitor", position: 1 },
				{ brandName: "Beta", mentionType: "competitor", position: 2 },
			],
			targetBrand,
			sentimentInput: neutralSentiment,
		});

		expect(result.mentionScore).toBe(0);
		expect(result.positionScore).toBe(0);
		expect(result.citationScore).toBe(0);
		expect(result.coMentionScore).toBe(0);
		expect(result.sentimentScore).toBe(50);
		expect(result.visibilityScore).toBe(5);
	});

	it("position decay matches the spec table (rank 1..8)", () => {
		const expected = [
			[1, 100],
			[2, 63],
			[3, 50],
			[4, 43],
			[5, 39],
			[6, 36],
			[7, 33],
			[8, 32],
		] as const;
		for (const [rank, expectedScore] of expected) {
			const result = computeVisibilityScore({
				crawlContent: "x",
				crawlProvider: "perplexity",
				crawlCitations: [],
				brandMentions: [
					{
						brandName: "MyBrand",
						mentionType: "target",
						position: rank,
					},
				],
				targetBrand,
				sentimentInput: positiveSentiment,
			});
			expect(result.positionScore).toBe(expectedScore);
		}
	});

	it("uses the BEST (earliest) position when the target is mentioned multiple times", () => {
		const result = computeVisibilityScore({
			crawlContent: "x",
			crawlProvider: "perplexity",
			crawlCitations: [],
			brandMentions: [
				{
					brandName: "MyBrand",
					mentionType: "target",
					position: 5,
				},
				{
					brandName: "MyBrand",
					mentionType: "target",
					position: 1,
				},
				{
					brandName: "MyBrand",
					mentionType: "target",
					position: 3,
				},
			],
			targetBrand,
			sentimentInput: positiveSentiment,
		});

		expect(result.positionScore).toBe(100);
	});

	it("citationScore is 100 when the target's domain appears in the citation list", () => {
		const result = computeVisibilityScore({
			crawlContent: "x",
			crawlProvider: "perplexity",
			crawlCitations: [
				{
					domain: "mybrand.com",
					url: "https://mybrand.com/post",
					position: 2,
				},
			],
			brandMentions: [
				{
					brandName: "MyBrand",
					mentionType: "target",
					position: 1,
					brandUrl: "https://mybrand.com",
				},
			],
			targetBrand,
			sentimentInput: positiveSentiment,
		});

		expect(result.citationScore).toBe(100);
	});

	it("coMentionScore is 0 when there are no brand mentions at all", () => {
		const result = computeVisibilityScore({
			crawlContent: "x",
			crawlProvider: "perplexity",
			crawlCitations: [],
			brandMentions: [],
			targetBrand,
			sentimentInput: positiveSentiment,
		});

		expect(result.coMentionScore).toBe(0);
	});

	it("recognises the target by alias even when mentionType is unset", () => {
		const result = computeVisibilityScore({
			crawlContent: "x",
			crawlProvider: "perplexity",
			crawlCitations: [],
			brandMentions: [
				{
					brandName: "MyBrand Inc",
					mentionType: "other",
					position: 1,
				},
			],
			targetBrand,
			sentimentInput: positiveSentiment,
		});

		expect(result.mentionScore).toBe(100);
		expect(result.positionScore).toBe(100);
	});

	it("returns 50 for sentimentScore when the LLM call fell back to neutral", () => {
		const result = computeVisibilityScore({
			crawlContent: "x",
			crawlProvider: "perplexity",
			crawlCitations: [],
			brandMentions: [
				{
					brandName: "MyBrand",
					mentionType: "target",
					position: 1,
				},
			],
			targetBrand,
			sentimentInput: {
				label: null,
				cacheHit: false,
				fallback: true,
				retryCount: 1,
			},
		});

		expect(result.sentimentScore).toBe(50);
	});

	it("emits the hard-coded formulaVersion", () => {
		const result = computeVisibilityScore({
			crawlContent: "x",
			crawlProvider: "perplexity",
			crawlCitations: [],
			brandMentions: [],
			targetBrand,
			sentimentInput: neutralSentiment,
		});

		expect(result.formulaVersion).toBe(FORMULA_VERSION);
		expect(result.formulaVersion).toBe("v1.0.0");
	});

	it("composite is bounded [0, 100] across a variety of inputs", () => {
		const samples: ComputeVisibilityScoreInput[] = [
			{
				crawlContent: "x",
				crawlProvider: "perplexity",
				crawlCitations: [],
				brandMentions: [],
				targetBrand,
				sentimentInput: neutralSentiment,
			},
			{
				crawlContent: "x",
				crawlProvider: "perplexity",
				crawlCitations: [
					{
						domain: "mybrand.com",
						url: "https://mybrand.com",
						position: 1,
					},
				],
				brandMentions: [
					{
						brandName: "MyBrand",
						mentionType: "target",
						position: 1,
						brandUrl: "https://mybrand.com",
					},
				],
				targetBrand,
				sentimentInput: positiveSentiment,
			},
			{
				crawlContent: "x",
				crawlProvider: "perplexity",
				crawlCitations: [],
				brandMentions: [
					{
						brandName: "MyBrand",
						mentionType: "target",
						position: 7,
					},
				],
				targetBrand,
				sentimentInput: {
					label: "negative",
					cacheHit: false,
					fallback: false,
					retryCount: 0,
				},
			},
		];

		for (const input of samples) {
			const result = computeVisibilityScore(input);
			expect(result.visibilityScore).toBeGreaterThanOrEqual(0);
			expect(result.visibilityScore).toBeLessThanOrEqual(100);
		}
	});

	it("PROMPT_VERSION is exported and stable", () => {
		expect(PROMPT_VERSION).toBe("v1.0.0");
	});
});
