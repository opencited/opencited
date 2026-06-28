import { z } from "zod";

export const humanLabelSchema = z.object({
	score: z.number().int().min(0).max(100),
	sentiment: z.enum(["positive", "neutral", "negative"]),
});
export type HumanLabel = z.infer<typeof humanLabelSchema>;

export const fixtureSchema = z.object({
	id: z.string().min(1),
	crawlData: z.record(z.string(), z.unknown()),
	humanLabel: humanLabelSchema.nullable(),
});
export type Fixture = z.infer<typeof fixtureSchema>;

export const validateOptionsSchema = z.object({
	spearmanThreshold: z.number().min(0).max(1).default(0.7),
	weightPerturbation: z.number().min(0).max(0.5).default(0.05),
	runs: z.number().int().min(1).default(5),
	weights: z.record(z.string(), z.number()).optional(),
});
export type ValidateOptions = z.input<typeof validateOptionsSchema>;

export interface ResolvedValidateOptions {
	spearmanThreshold: number;
	weightPerturbation: number;
	runs: number;
	weights?: Record<string, number>;
}

export interface ValidateResult {
	spearmanCorrelation: number;
	weightStability: number;
	determinismCheck: boolean;
	cacheHitRate: number;
}

export type ComputeFn<TCrawlData = Record<string, unknown>> = (
	crawlData: TCrawlData,
	weights?: Record<string, number>,
) => number | Promise<number>;

export const MIN_LABELLED_FIXTURES = 50;
