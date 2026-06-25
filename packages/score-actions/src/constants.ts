export const FORMULA_VERSION = "v1.0.0";

export const SUB_SCORE_WEIGHTS = {
	mention: 0.35,
	position: 0.25,
	citation: 0.2,
	sentiment: 0.1,
	coMention: 0.1,
} as const;

export const SENTIMENT_LABELS = ["positive", "neutral", "negative"] as const;
export type SentimentLabel = (typeof SENTIMENT_LABELS)[number];

export const SENTIMENT_SCORE_MAP: Record<SentimentLabel, number> = {
	positive: 100,
	neutral: 50,
	negative: 0,
};

export const PROMPT_VERSION = "v1.0.0";

export const COLD_START_MIN_CRAWLS = 3;
export const WINSORISE_PERCENTILE = 0.05;
