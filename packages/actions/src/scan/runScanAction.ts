import { runTechnicalScan, type ScanOptions } from "@opencited/scanner";
import { z } from "zod";

export const FREE_ISSUE_LIMIT = 3;

export type ReadinessLevel = "ready" | "needs-work" | "not-ready";

export const runScanInputSchema = z.object({
	domain: z
		.string()
		.trim()
		.min(1, "Enter a domain to scan.")
		.max(2048, "That URL is too long to scan."),
});

export const scanIssueSchema = z.object({
	check: z.string(),
	goal: z.string(),
	issue: z.string(),
	howToFix: z.string(),
	weight: z.number(),
});

export const runScanOutputSchema = z.object({
	domain: z.string(),
	finalUrl: z.string(),
	score: z.number().int().min(0).max(100),
	readiness: z.enum(["ready", "needs-work", "not-ready"]),
	issues: z.array(scanIssueSchema).max(FREE_ISSUE_LIMIT),
	issueCount: z.number().int().min(0),
	durationMs: z.number().int().min(0),
});

export type RunScanOutput = z.infer<typeof runScanOutputSchema>;

export function getReadinessLevel(score: number): ReadinessLevel {
	if (score >= 70) return "ready";
	if (score >= 40) return "needs-work";
	return "not-ready";
}

export const runScanAction = async (params: {
	input: z.infer<typeof runScanInputSchema>;
	options?: ScanOptions;
}): Promise<RunScanOutput> => {
	const result = await runTechnicalScan(params.input.domain, params.options);

	return {
		domain: result.domain,
		finalUrl: result.finalUrl,
		score: result.score,
		readiness: getReadinessLevel(result.score),
		issues: result.issues.slice(0, FREE_ISSUE_LIMIT),
		issueCount: result.issues.length,
		durationMs: result.durationMs,
	};
};

export const runScanHandler = async (params: {
	input: z.infer<typeof runScanInputSchema>;
	options?: ScanOptions;
}): Promise<RunScanOutput> => runScanAction(params);
