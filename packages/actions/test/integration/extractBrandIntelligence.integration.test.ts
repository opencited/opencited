import { describe, test, expect } from "bun:test";
import { extractBrandIntelligenceAction } from "../../src/ai/extractBrandIntelligenceAction";
import { TEST_CONTENT, TEST_QUERY, TARGET_BRAND } from "./fixtures";

const isIntegration = !!process.env.RUN_INTEGRATION;

describe.skipIf(!isIntegration)(
	"extractBrandIntelligenceAction — integration (real Groq LLM)",
	() => {
		test("extracts brand mentions with valid positions from real content", async () => {
			const result = await extractBrandIntelligenceAction({
				content: TEST_CONTENT,
				query: TEST_QUERY,
				targetBrand: TARGET_BRAND.name,
				targetDomain: TARGET_BRAND.domain,
				targetAliases: TARGET_BRAND.aliases,
				knownCompetitors: [],
			});

			expect(result.brandMentions.length).toBeGreaterThan(0);

			for (const mention of result.brandMentions) {
				expect(mention.position).toBeGreaterThanOrEqual(1);
				expect(Number.isInteger(mention.position)).toBe(true);
			}

			const positions = result.brandMentions.map((m) => m.position);
			const uniquePositions = new Set(positions);
			expect(uniquePositions.size).toBeGreaterThan(0);
		}, 60_000);

		test("classifies target brand correctly", async () => {
			const result = await extractBrandIntelligenceAction({
				content: TEST_CONTENT,
				query: TEST_QUERY,
				targetBrand: TARGET_BRAND.name,
				targetDomain: TARGET_BRAND.domain,
				targetAliases: TARGET_BRAND.aliases,
				knownCompetitors: [],
			});

			const targetMentions = result.brandMentions.filter(
				(m) => m.mentionType === "target",
			);
			expect(targetMentions.length).toBeGreaterThanOrEqual(1);

			const targetNames = targetMentions.map((m) => m.brandName.toLowerCase());
			const isRecognized = targetNames.some(
				(name) =>
					name.includes("opencited") ||
					TARGET_BRAND.aliases.some((a) => a.toLowerCase().includes(name)),
			);
			expect(isRecognized).toBe(true);
		}, 60_000);

		test("discovers competitors not in known list", async () => {
			const result = await extractBrandIntelligenceAction({
				content: TEST_CONTENT,
				query: TEST_QUERY,
				targetBrand: TARGET_BRAND.name,
				targetDomain: TARGET_BRAND.domain,
				targetAliases: TARGET_BRAND.aliases,
				knownCompetitors: [],
			});

			const competitorMentions = result.brandMentions.filter(
				(m) => m.mentionType === "competitor",
			);
			if (competitorMentions.length > 0) {
				expect(result.discoveredCompetitors.length).toBeGreaterThan(0);
				for (const comp of result.discoveredCompetitors) {
					expect(comp.name.length).toBeGreaterThan(0);
					expect(comp.domain.length).toBeGreaterThan(0);
				}
			}
		}, 60_000);

		test("returns valid answerFormat", async () => {
			const result = await extractBrandIntelligenceAction({
				content: TEST_CONTENT,
				query: TEST_QUERY,
				targetBrand: TARGET_BRAND.name,
				targetDomain: TARGET_BRAND.domain,
				targetAliases: TARGET_BRAND.aliases,
				knownCompetitors: [],
			});

			expect([
				"numbered_list",
				"paragraph",
				"comparison_table",
				"conversational",
				"unknown",
			]).toContain(result.answerFormat);
		}, 60_000);
	},
);
