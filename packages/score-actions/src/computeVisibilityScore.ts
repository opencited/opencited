import { createHash } from "node:crypto";
import {
	FORMULA_VERSION,
	SENTIMENT_SCORE_MAP,
	SUB_SCORE_WEIGHTS,
} from "./constants";
import type {
	BrandMention,
	ComputeVisibilityScoreInput,
	CrawlCitation,
	SentimentInput,
	TargetBrand,
	VisibilityScoreResult,
} from "./types";

function isTargetMention(mention: BrandMention, target: TargetBrand): boolean {
	if (mention.mentionType === "target") return true;
	const lower = mention.brandName.toLowerCase();
	if (lower === target.name.toLowerCase()) return true;
	if (target.aliases.some((a) => a.toLowerCase() === lower)) return true;
	return false;
}

function targetOwnDomain(brandMentions: BrandMention[]): string | null {
	for (const m of brandMentions) {
		if (m.mentionType === "target" && m.brandUrl) {
			try {
				return new URL(m.brandUrl).hostname.replace(/^www\./, "");
			} catch {
				// ignore invalid URLs and try the next mention
			}
		}
	}
	return null;
}

function extractHostname(url: string): string | null {
	try {
		return new URL(url).hostname.replace(/^www\./, "");
	} catch {
		return null;
	}
}

function computeMentionScore(
	brandMentions: BrandMention[],
	target: TargetBrand,
): number {
	return brandMentions.some((m) => isTargetMention(m, target)) ? 100 : 0;
}

function computePositionScore(
	brandMentions: BrandMention[],
	target: TargetBrand,
): number {
	const targetMentions = brandMentions
		.filter((m) => isTargetMention(m, target) && m.position !== undefined)
		.sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity));

	if (targetMentions.length === 0) return 0;

	const bestRank = targetMentions[0]?.position;
	if (bestRank === undefined || bestRank <= 0) return 0;

	return Math.round(100 / Math.log2(1 + bestRank));
}

function computeCitationScore(
	citations: CrawlCitation[],
	brandMentions: BrandMention[],
	target: TargetBrand,
): number {
	const ownDomain =
		targetOwnDomain(brandMentions) ??
		extractHostname(`https://${target.domain}`);

	return citations.some(
		(c) =>
			(extractHostname(c.url) === ownDomain ||
				c.domain.toLowerCase().replace(/^www\./, "") === ownDomain) &&
			ownDomain !== null,
	)
		? 100
		: 0;
}

function computeSentimentScore(sentiment: SentimentInput): number {
	if (sentiment.label === null || sentiment.fallback) {
		return 50;
	}
	return SENTIMENT_SCORE_MAP[sentiment.label];
}

function computeCoMentionScore(brandMentions: BrandMention[]): number {
	const total = brandMentions.length;
	if (total === 0) return 0;
	const targetCount = brandMentions.filter(
		(m) => m.mentionType === "target",
	).length;
	return Math.round((100 * targetCount) / total);
}

function computeComposite(
	subScores: Pick<
		VisibilityScoreResult,
		| "mentionScore"
		| "positionScore"
		| "citationScore"
		| "sentimentScore"
		| "coMentionScore"
	>,
): number {
	const raw =
		subScores.mentionScore * SUB_SCORE_WEIGHTS.mention +
		subScores.positionScore * SUB_SCORE_WEIGHTS.position +
		subScores.citationScore * SUB_SCORE_WEIGHTS.citation +
		subScores.sentimentScore * SUB_SCORE_WEIGHTS.sentiment +
		subScores.coMentionScore * SUB_SCORE_WEIGHTS.coMention;
	return Math.round(raw);
}

export function computeVisibilityScore(
	input: ComputeVisibilityScoreInput,
): VisibilityScoreResult {
	const mentionScore = computeMentionScore(
		input.brandMentions,
		input.targetBrand,
	);
	const positionScore = computePositionScore(
		input.brandMentions,
		input.targetBrand,
	);
	const citationScore = computeCitationScore(
		input.crawlCitations,
		input.brandMentions,
		input.targetBrand,
	);
	const sentimentScore = computeSentimentScore(input.sentimentInput);
	const coMentionScore = computeCoMentionScore(input.brandMentions);

	const visibilityScore = computeComposite({
		mentionScore,
		positionScore,
		citationScore,
		sentimentScore,
		coMentionScore,
	});

	return {
		mentionScore,
		positionScore,
		citationScore,
		sentimentScore,
		coMentionScore,
		visibilityScore,
		formulaVersion: FORMULA_VERSION,
		computedAt: new Date(),
	};
}

export function cacheKey(params: {
	content: string;
	promptVersion: string;
	modelName: string;
	brandName: string;
}): string {
	const payload = `${params.content}\u0000${params.promptVersion}\u0000${params.modelName}\u0000${params.brandName}`;
	return createHash("sha256").update(payload).digest("hex");
}
