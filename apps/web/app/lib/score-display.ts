export type ScoreTier = "high" | "mid" | "low";

export function getScoreTier(value: number): ScoreTier {
	if (value >= 70) return "high";
	if (value >= 40) return "mid";
	return "low";
}

export const TIER_DOT_CLASSES: Record<ScoreTier, string> = {
	high: "bg-emerald-500",
	mid: "bg-amber-500",
	low: "bg-muted-foreground/40",
} as const;

export const TIER_BAR_CLASSES: Record<ScoreTier, string> = {
	high: "bg-emerald-500",
	mid: "bg-amber-500",
	low: "bg-muted",
} as const;
