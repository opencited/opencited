import type {
	ComputeFn,
	ResolvedValidateOptions,
	ValidateOptions,
	ValidateResult,
} from "./types";
import { MIN_LABELLED_FIXTURES } from "./types";

function assignRanks(values: number[]): number[] {
	const n = values.length;
	const indexed = values.map((v, i) => ({ v, i }));
	indexed.sort((a, b) => a.v - b.v);
	const ranks = new Array<number>(n);
	let i = 0;
	while (i < n) {
		let j = i;
		while (j < n - 1 && indexed[j + 1]?.v === indexed[j]?.v) j++;
		const avgRank = (i + j) / 2 + 1;
		for (let k = i; k <= j; k++) {
			const entry = indexed[k];
			if (entry) ranks[entry.i] = avgRank;
		}
		i = j + 1;
	}
	return ranks;
}

function computeSpearman(x: number[], y: number[]): number {
	const n = x.length;
	if (n < 2) return 0;

	const rx = assignRanks(x);
	const ry = assignRanks(y);

	const meanX = rx.reduce((a, b) => a + b, 0) / n;
	const meanY = ry.reduce((a, b) => a + b, 0) / n;

	let num = 0;
	let denX = 0;
	let denY = 0;
	for (let idx = 0; idx < n; idx++) {
		const rxVal = rx[idx] ?? 0;
		const ryVal = ry[idx] ?? 0;
		const dx = rxVal - meanX;
		const dy = ryVal - meanY;
		num += dx * dy;
		denX += dx * dx;
		denY += dy * dy;
	}

	const den = Math.sqrt(denX * denY);
	return den === 0 ? 0 : num / den;
}

function perturbWeights(
	weights: Record<string, number>,
	factor: number,
): Record<string, number> {
	const keys = Object.keys(weights);
	const perturbed: Record<string, number> = {};
	for (const key of keys) {
		perturbed[key] = (weights[key] ?? 0) * (1 + factor);
	}
	const sum = Object.values(perturbed).reduce((a, b) => a + b, 0);
	for (const key of keys) {
		perturbed[key] = (perturbed[key] ?? 0) / sum;
	}
	return perturbed;
}

function assignDescendingRanks(values: number[]): number[] {
	const n = values.length;
	const indexed = values.map((v, i) => ({ v, i }));
	indexed.sort((a, b) => b.v - a.v);
	const ranks = new Array<number>(n);
	let i = 0;
	while (i < n) {
		let j = i;
		while (j < n - 1 && indexed[j]?.v === indexed[j + 1]?.v) j++;
		const avgRank = (i + j) / 2 + 1;
		for (let k = i; k <= j; k++) {
			const entry = indexed[k];
			if (entry) ranks[entry.i] = avgRank;
		}
		i = j + 1;
	}
	return ranks;
}

export async function validateScoreAgreement<
	TCrawlData = Record<string, unknown>,
>({
	fixtures,
	compute,
	options,
}: {
	fixtures: {
		crawlData: TCrawlData;
		humanLabel: { score: number; sentiment: string } | null;
	}[];
	compute: ComputeFn<TCrawlData>;
	options?: ValidateOptions;
}): Promise<ValidateResult> {
	const opts: ResolvedValidateOptions = {
		spearmanThreshold: 0.7,
		weightPerturbation: 0.05,
		runs: 5,
		...options,
	};

	const firstRunScores: number[] = [];
	for (const fixture of fixtures) {
		firstRunScores.push(await compute(fixture.crawlData));
	}

	let determinismCheck = true;
	for (let run = 1; run < opts.runs; run++) {
		for (let i = 0; i < fixtures.length; i++) {
			const fixture = fixtures[i];
			if (!fixture) continue;
			const score = await compute(fixture.crawlData);
			const expected = firstRunScores[i];
			if (expected === undefined || score !== expected) {
				determinismCheck = false;
				break;
			}
		}
		if (!determinismCheck) break;
	}

	const memoCache = new Map<string, number>();
	const cacheKeyFor = (data: unknown): string => {
		try {
			return JSON.stringify(data);
		} catch {
			return String(data);
		}
	};

	for (let i = 0; i < fixtures.length; i++) {
		const fixture = fixtures[i];
		const score = firstRunScores[i];
		if (fixture && score !== undefined) {
			const key = cacheKeyFor(fixture.crawlData);
			memoCache.set(key, score);
		}
	}

	let cacheHits = 0;
	for (const fixture of fixtures) {
		const key = cacheKeyFor(fixture.crawlData);
		const cachedScore = memoCache.get(key);
		if (cachedScore !== undefined) {
			const secondRunScore = await compute(fixture.crawlData);
			if (secondRunScore === cachedScore) {
				cacheHits++;
			}
		}
	}
	const cacheHitRate = fixtures.length > 0 ? cacheHits / fixtures.length : 0;

	const humanScores: number[] = [];
	const computedScoresForLabelled: number[] = [];
	for (let i = 0; i < fixtures.length; i++) {
		const f = fixtures[i];
		const score = firstRunScores[i];
		if (
			f?.humanLabel !== null &&
			f?.humanLabel !== undefined &&
			score !== undefined
		) {
			humanScores.push(f.humanLabel.score);
			computedScoresForLabelled.push(score);
		}
	}

	const spearmanValue =
		humanScores.length >= 2
			? computeSpearman(humanScores, computedScoresForLabelled)
			: 0;

	let weightStability = 0;
	if (opts.weights && fixtures.length > 0) {
		const perturbedUp = perturbWeights(opts.weights, opts.weightPerturbation);
		const perturbedDown = perturbWeights(
			opts.weights,
			-opts.weightPerturbation,
		);

		const scoresUp: number[] = [];
		const scoresDown: number[] = [];
		for (const fixture of fixtures) {
			scoresUp.push(await compute(fixture.crawlData, perturbedUp));
			scoresDown.push(await compute(fixture.crawlData, perturbedDown));
		}

		const origRanks = assignDescendingRanks(firstRunScores);
		const upRanks = assignDescendingRanks(scoresUp);
		const downRanks = assignDescendingRanks(scoresDown);

		let maxMove = 0;
		for (let i = 0; i < fixtures.length; i++) {
			const orig = origRanks[i] ?? 0;
			const up = upRanks[i] ?? 0;
			const down = downRanks[i] ?? 0;
			maxMove = Math.max(maxMove, Math.abs(up - orig));
			maxMove = Math.max(maxMove, Math.abs(down - orig));
		}
		weightStability = maxMove;
	}

	return {
		spearmanCorrelation: spearmanValue,
		weightStability,
		determinismCheck,
		cacheHitRate,
	};
}

export { MIN_LABELLED_FIXTURES };
