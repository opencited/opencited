import { describe, expect, it, mock } from "bun:test";

mock.module("@opentelemetry/api", () => ({
	trace: {
		getTracer: () => ({
			startSpan: (_name: string, _opts: unknown, fn: unknown) => {
				if (typeof fn === "function") return fn({}, { active: () => ({}) });
				return {};
			},
		}),
	},
	context: {
		active: () => ({}),
		with: (_ctx: unknown, fn: (...args: unknown[]) => unknown) => fn(),
	},
	propagation: { getBaggage: () => undefined },
	metrics: { getMeter: () => ({}) },
	diag: { setLogger: () => {}, createDiagLogger: () => ({}) },
	SpanStatusCode: { OK: 0, ERROR: 1, UNSET: 2 },
	SpanKind: { INTERNAL: 0, SERVER: 1, CLIENT: 2, PRODUCER: 3, CONSUMER: 4 },
	ValueType: { INT: 0, DOUBLE: 1 },
}));

import {
	aiBrandMentionSchema,
	buildExtractionPrompt,
	extractBrandIntelligenceOutputSchema,
} from "../src/ai/extractBrandIntelligenceAction";

describe("aiBrandMentionSchema — position field", () => {
	it("rejects a mention without position", () => {
		const result = aiBrandMentionSchema.safeParse({
			brandName: "Acme",
			brandUrl: "https://acme.com",
			context: "Acme is mentioned here.",
			mentionType: "competitor",
		});
		expect(result.success).toBe(false);
	});

	it("rejects a mention with non-positive position", () => {
		for (const bad of [0, -1, -100, 1.5, NaN]) {
			const result = aiBrandMentionSchema.safeParse({
				brandName: "Acme",
				brandUrl: "https://acme.com",
				context: "Acme is mentioned here.",
				mentionType: "competitor",
				position: bad,
			});
			expect(result.success).toBe(false);
		}
	});

	it("accepts a mention with a positive integer position", () => {
		const result = aiBrandMentionSchema.safeParse({
			brandName: "Acme",
			brandUrl: "https://acme.com",
			context: "Acme is mentioned here.",
			mentionType: "competitor",
			position: 1,
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.position).toBe(1);
		}
	});
});

describe("extractBrandIntelligenceOutputSchema — position is required per mention", () => {
	it("rejects an output where any mention is missing position", () => {
		const result = extractBrandIntelligenceOutputSchema.safeParse({
			brandMentions: [
				{
					brandName: "Acme",
					brandUrl: "https://acme.com",
					context: "Acme is mentioned here.",
					mentionType: "competitor",
					position: 1,
				},
				{
					brandName: "Beta",
					brandUrl: "https://beta.com",
					context: "Beta is mentioned too.",
					mentionType: "competitor",
				},
			],
			discoveredCompetitors: [],
			answerFormat: "numbered_list",
		});
		expect(result.success).toBe(false);
	});

	it("accepts an output where every mention has a positive integer position", () => {
		const result = extractBrandIntelligenceOutputSchema.safeParse({
			brandMentions: [
				{
					brandName: "MyBrand",
					brandUrl: "https://mybrand.com",
					context: "First mention.",
					mentionType: "target",
					position: 1,
				},
				{
					brandName: "Acme",
					brandUrl: "https://acme.com",
					context: "Second mention.",
					mentionType: "competitor",
					position: 2,
				},
				{
					brandName: "Beta",
					brandUrl: "https://beta.com",
					context: "Third mention.",
					mentionType: "competitor",
					position: 3,
				},
			],
			discoveredCompetitors: [
				{ name: "Acme", domain: "acme.com" },
				{ name: "Beta", domain: "beta.com" },
			],
			answerFormat: "numbered_list",
		});
		expect(result.success).toBe(true);
	});

	it("accepts an empty brandMentions array (no positions needed)", () => {
		const result = extractBrandIntelligenceOutputSchema.safeParse({
			brandMentions: [],
			discoveredCompetitors: [],
			answerFormat: "unknown",
		});
		expect(result.success).toBe(true);
	});
});

describe("buildExtractionPrompt — position instructions", () => {
	const baseInput = {
		content: "Some AI response body.",
		query: "best AEO tools",
		targetBrand: "MyBrand",
		targetDomain: "mybrand.com",
		targetAliases: ["MyBrand Inc"],
		knownCompetitors: [{ name: "Acme", domain: "acme.com" }],
	};

	it("instructs the LLM to assign ordinal ranks by first appearance", () => {
		const prompt = buildExtractionPrompt(baseInput);
		expect(prompt).toMatch(/position/i);
		expect(prompt).toMatch(/1-indexed/i);
		expect(prompt).toMatch(/first appearance/i);
	});

	it("instructs the LLM that positions must be unique", () => {
		const prompt = buildExtractionPrompt(baseInput);
		expect(prompt).toMatch(/unique/i);
	});

	it("explains why position matters (downstream score)", () => {
		const prompt = buildExtractionPrompt(baseInput);
		expect(prompt).toMatch(/visibility score|100\/log2/i);
	});

	it("includes position in the JSON schema example", () => {
		const prompt = buildExtractionPrompt(baseInput);
		expect(prompt).toMatch(/"position"\s*:/);
	});
});
