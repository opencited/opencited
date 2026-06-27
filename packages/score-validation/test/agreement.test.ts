import { describe, expect, it } from "bun:test";
import {
	computeVisibilityScore,
	SUB_SCORE_WEIGHTS,
} from "@opencited/score-actions";
import type { ComputeVisibilityScoreInput } from "@opencited/score-actions";
import { MIN_LABELLED_FIXTURES, validateScoreAgreement } from "../src";
import groundTruth from "../fixtures/ground-truth.json";

type SeedFixture = {
	id: string;
	crawlData: ComputeVisibilityScoreInput;
	humanLabel: { score: number; sentiment: string } | null;
};

const fixtures = groundTruth as SeedFixture[];

function compute(
	crawlData: ComputeVisibilityScoreInput,
	weights?: Record<string, number>,
): number {
	const result = computeVisibilityScore(crawlData);
	if (!weights) return result.visibilityScore;
	return Math.round(
		result.mentionScore * (weights.mention ?? 0) +
			result.positionScore * (weights.position ?? 0) +
			result.citationScore * (weights.citation ?? 0) +
			result.sentimentScore * (weights.sentiment ?? 0) +
			result.coMentionScore * (weights.coMention ?? 0),
	);
}

const labelledCount = fixtures.filter((f) => f.humanLabel !== null).length;
const isGated = labelledCount >= MIN_LABELLED_FIXTURES;

describe("score validation harness", () => {
	it("runs the harness and reports metrics", async () => {
		const result = await validateScoreAgreement({
			fixtures,
			compute,
			options: {
				weights: { ...SUB_SCORE_WEIGHTS },
			},
		});

		console.log("=== Score Validation Report ===");
		console.log(
			`Fixtures: ${fixtures.length} total, ${labelledCount} labelled`,
		);
		console.log(
			`Spearman correlation: ${result.spearmanCorrelation.toFixed(4)}`,
		);
		console.log(`Weight stability (max rank move): ${result.weightStability}`);
		console.log(`Determinism check: ${result.determinismCheck}`);
		console.log(`Cache hit rate: ${result.cacheHitRate.toFixed(4)}`);
		console.log(`CI gate: ${isGated ? "ACTIVE" : "report-only"}`);
		console.log("===============================");

		if (!isGated) {
			console.log(
				`Skipping assertions: ${labelledCount}/${MIN_LABELLED_FIXTURES} labelled fixtures (need ${MIN_LABELLED_FIXTURES} to activate CI gate)`,
			);
			return;
		}

		expect(result.spearmanCorrelation).toBeGreaterThanOrEqual(0.7);
		expect(result.weightStability).toBeLessThanOrEqual(1);
		expect(result.determinismCheck).toBe(true);
		expect(result.cacheHitRate).toBe(1.0);
	});

	it("determinism check passes for pure compute function", async () => {
		const result = await validateScoreAgreement({
			fixtures,
			compute,
		});

		expect(result.determinismCheck).toBe(true);
	});

	it("cache hit rate is 1.0 for deterministic compute", async () => {
		const result = await validateScoreAgreement({
			fixtures,
			compute,
		});

		expect(result.cacheHitRate).toBe(1.0);
	});

	it("spearman correlation is 0 when no fixtures are labelled", async () => {
		const unlabelledFixtures = fixtures.map((f) => ({
			...f,
			humanLabel: null as null,
		}));

		const result = await validateScoreAgreement({
			fixtures: unlabelledFixtures,
			compute,
		});

		expect(result.spearmanCorrelation).toBe(0);
	});
});
