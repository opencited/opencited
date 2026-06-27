import {
	COLD_START_MIN_CRAWLS,
	SUB_SCORE_WEIGHTS,
	WINSORISE_PERCENTILE,
} from "./constants";
import type {
	AggregateOptions,
	AggregateVisibilityScoresResult,
	PerBrandPerEngineScore,
	ScoredCrawl,
	TrendPoint,
} from "./types";

type SubScoreKey =
	| "mentionScore"
	| "positionScore"
	| "citationScore"
	| "sentimentScore"
	| "coMentionScore";

const SUB_SCORE_KEYS: SubScoreKey[] = [
	"mentionScore",
	"positionScore",
	"citationScore",
	"sentimentScore",
	"coMentionScore",
];

function percentile(sorted: number[], p: number): number {
	if (sorted.length === 0) return 0;
	if (sorted.length === 1) return sorted[0] as number;
	const index = p * (sorted.length - 1);
	const lower = Math.floor(index);
	const upper = Math.ceil(index);
	if (lower === upper) return sorted[lower] as number;
	return (
		(sorted[lower] as number) +
		((sorted[upper] as number) - (sorted[lower] as number)) * (index - lower)
	);
}

function winsorisedMinMax(
	values: number[],
	winsorisePercentile: number,
): { min: number; max: number } {
	if (values.length === 0) return { min: 0, max: 0 };
	const sorted = [...values].sort((a, b) => a - b);
	const min = percentile(sorted, winsorisePercentile);
	const max = percentile(sorted, 1 - winsorisePercentile);
	return { min, max };
}

function normalise(value: number, min: number, max: number): number {
	if (max <= min) return 50;
	const norm = (100 * (value - min)) / (max - min);
	return Math.max(0, Math.min(100, Math.round(norm)));
}

function computeWeightedComposite(scores: Record<SubScoreKey, number>): number {
	const raw =
		scores.mentionScore * SUB_SCORE_WEIGHTS.mention +
		scores.positionScore * SUB_SCORE_WEIGHTS.position +
		scores.citationScore * SUB_SCORE_WEIGHTS.citation +
		scores.sentimentScore * SUB_SCORE_WEIGHTS.sentiment +
		scores.coMentionScore * SUB_SCORE_WEIGHTS.coMention;
	return Math.round(raw);
}

function groupByEngine(crawls: ScoredCrawl[]): Map<string, ScoredCrawl[]> {
	const map = new Map<string, ScoredCrawl[]>();
	for (const crawl of crawls) {
		const existing = map.get(crawl.engine) ?? [];
		existing.push(crawl);
		map.set(crawl.engine, existing);
	}
	return map;
}

function groupByBrand(crawls: ScoredCrawl[]): Map<string, ScoredCrawl[]> {
	const map = new Map<string, ScoredCrawl[]>();
	for (const crawl of crawls) {
		const existing = map.get(crawl.brandId) ?? [];
		existing.push(crawl);
		map.set(crawl.brandId, existing);
	}
	return map;
}

function computeBrandAverages(
	crawls: ScoredCrawl[],
): Record<SubScoreKey, number> {
	if (crawls.length === 0) {
		return {
			mentionScore: 0,
			positionScore: 0,
			citationScore: 0,
			sentimentScore: 50,
			coMentionScore: 0,
		};
	}

	const totals: Record<SubScoreKey, number> = {
		mentionScore: 0,
		positionScore: 0,
		citationScore: 0,
		sentimentScore: 0,
		coMentionScore: 0,
	};

	for (const crawl of crawls) {
		for (const key of SUB_SCORE_KEYS) {
			totals[key] += crawl[key];
		}
	}

	return {
		mentionScore: totals.mentionScore / crawls.length,
		positionScore: totals.positionScore / crawls.length,
		citationScore: totals.citationScore / crawls.length,
		sentimentScore: totals.sentimentScore / crawls.length,
		coMentionScore: totals.coMentionScore / crawls.length,
	};
}

function computePerBrandPerEngineScore(
	engineCrawls: ScoredCrawl[],
	targetBrandId: string,
	winsorisePercentile: number,
): PerBrandPerEngineScore | null {
	const byBrand = groupByBrand(engineCrawls);

	const peerBrandIds = Array.from(byBrand.keys()).filter(
		(id) => id !== targetBrandId,
	);

	if (peerBrandIds.length === 0) return null;

	const allBrandAverages = new Map<string, Record<SubScoreKey, number>>();
	for (const [brandId, crawls] of byBrand) {
		allBrandAverages.set(brandId, computeBrandAverages(crawls));
	}

	const targetAverages = allBrandAverages.get(targetBrandId);
	if (!targetAverages) return null;

	const normalisedScores: Record<SubScoreKey, number> = {
		mentionScore: 0,
		positionScore: 0,
		citationScore: 0,
		sentimentScore: 0,
		coMentionScore: 0,
	};

	for (const key of SUB_SCORE_KEYS) {
		const allValues = Array.from(allBrandAverages.values()).map((a) => a[key]);
		const { min, max } = winsorisedMinMax(allValues, winsorisePercentile);
		normalisedScores[key] = normalise(targetAverages[key], min, max);
	}

	const engine = engineCrawls[0]?.engine ?? "";
	const score = computeWeightedComposite(normalisedScores);

	return {
		engine,
		mentionScoreNorm: normalisedScores.mentionScore,
		positionScoreNorm: normalisedScores.positionScore,
		citationScoreNorm: normalisedScores.citationScore,
		sentimentScoreNorm: normalisedScores.sentimentScore,
		coMentionScoreNorm: normalisedScores.coMentionScore,
		score,
	};
}

function computeTrend(
	crawls: ScoredCrawl[],
	targetBrandId: string,
	minCrawlsPerEngine: number,
	winsorisePercentile: number,
): TrendPoint[] {
	const trend: TrendPoint[] = [];
	const now = new Date();
	now.setHours(23, 59, 59, 999);

	for (let daysAgo = 29; daysAgo >= 0; daysAgo--) {
		const dayStart = new Date(now);
		dayStart.setDate(dayStart.getDate() - daysAgo);
		dayStart.setHours(0, 0, 0, 0);

		const dayEnd = new Date(dayStart);
		dayEnd.setHours(23, 59, 59, 999);

		const dayCrawls = crawls.filter((c) => {
			const t = c.completedAt.getTime();
			return t >= dayStart.getTime() && t <= dayEnd.getTime();
		});

		const byEngine = groupByEngine(dayCrawls);
		const engineScores: number[] = [];

		for (const [_engine, engineCrawls] of byEngine) {
			const targetCrawls = engineCrawls.filter(
				(c) => c.brandId === targetBrandId,
			);
			if (targetCrawls.length < minCrawlsPerEngine) continue;

			const peerBrandIds = new Set(
				engineCrawls.map((c) => c.brandId).filter((id) => id !== targetBrandId),
			);
			if (peerBrandIds.size === 0) continue;

			const result = computePerBrandPerEngineScore(
				engineCrawls,
				targetBrandId,
				winsorisePercentile,
			);
			if (result) {
				engineScores.push(result.score);
			}
		}

		const dateStr = dayStart.toISOString().split("T")[0] as string;
		if (engineScores.length === 0) {
			trend.push({ date: dateStr, score: null });
		} else {
			const avg =
				engineScores.reduce((sum, s) => sum + s, 0) / engineScores.length;
			trend.push({ date: dateStr, score: Math.round(avg) });
		}
	}

	return trend;
}

export function aggregateVisibilityScores(
	crawls: ScoredCrawl[],
	targetBrandId: string,
	options?: AggregateOptions,
): AggregateVisibilityScoresResult {
	const minCrawlsPerEngine =
		options?.minCrawlsPerEngine ?? COLD_START_MIN_CRAWLS;
	const winsorisePercentile =
		options?.winsorisePercentile ?? WINSORISE_PERCENTILE;

	const byEngine = groupByEngine(crawls);
	const perBrandPerEngineScores: PerBrandPerEngineScore[] = [];

	for (const [_engine, engineCrawls] of byEngine) {
		const targetCrawls = engineCrawls.filter(
			(c) => c.brandId === targetBrandId,
		);
		if (targetCrawls.length < minCrawlsPerEngine) continue;

		const peerBrandIds = new Set(
			engineCrawls.map((c) => c.brandId).filter((id) => id !== targetBrandId),
		);
		if (peerBrandIds.size === 0) continue;

		const result = computePerBrandPerEngineScore(
			engineCrawls,
			targetBrandId,
			winsorisePercentile,
		);
		if (result) {
			perBrandPerEngineScores.push(result);
		}
	}

	let crossEngineScore: number | null = null;
	if (perBrandPerEngineScores.length > 0) {
		const total = perBrandPerEngineScores.reduce((sum, s) => sum + s.score, 0);
		crossEngineScore = Math.round(total / perBrandPerEngineScores.length);
	}

	const trend = computeTrend(
		crawls,
		targetBrandId,
		minCrawlsPerEngine,
		winsorisePercentile,
	);

	return {
		perBrandPerEngineScores,
		crossEngineScore,
		trend,
	};
}
