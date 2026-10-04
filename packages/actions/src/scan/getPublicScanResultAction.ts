import { aiMentionProbeQueryResultSchema } from "@opencited/db";
import { z } from "zod";
import { baseActionContextSchema } from "../context";
import {
	FREE_ISSUE_LIMIT,
	runScanOutputSchema,
	scanIssueSchema,
	type ReadinessLevel,
} from "./runScanAction";
import type { ScanRepository } from "./scanRepository";
import { createDrizzleScanRepository } from "./scanRepository";
import { ScanReportError } from "./scanErrors";

export const getPublicScanResultInputSchema = z.string().uuid();

/** Cached Perplexity probe only — never pending/unavailable on the public page. */
export const publicScanAiVisibilitySchema = z.object({
	status: z.literal("ok"),
	queries: z.array(aiMentionProbeQueryResultSchema),
});

export const getPublicScanResultOutputSchema = runScanOutputSchema.extend({
	scanId: z.string().uuid(),
	scannedAt: z.string().datetime(),
	probe: publicScanAiVisibilitySchema.optional(),
});

export const getPublicScanResultContextSchema = baseActionContextSchema.extend({
	scanRepo: z.custom<ScanRepository>().optional(),
});

export const getPublicScanResultAction = async (params: {
	input: z.infer<typeof getPublicScanResultInputSchema>;
	ctx: z.infer<typeof getPublicScanResultContextSchema>;
}): Promise<z.infer<typeof getPublicScanResultOutputSchema>> => {
	const repo =
		params.ctx.scanRepo ?? createDrizzleScanRepository(params.ctx.db);

	const scan = await repo.getPublicScanById(params.input);
	if (!scan) {
		throw new ScanReportError("Scan not found.");
	}

	const readiness = scan.readiness as ReadinessLevel;
	const issues = scan.issues
		.slice(0, FREE_ISSUE_LIMIT)
		.map((issue) => scanIssueSchema.parse(issue));

	const probe =
		scan.aiMentionProbe?.status === "ok"
			? publicScanAiVisibilitySchema.parse(scan.aiMentionProbe)
			: undefined;

	return {
		scanId: scan.id,
		domain: scan.domain,
		finalUrl: scan.finalUrl,
		score: scan.score,
		readiness,
		issues,
		issueCount: scan.issues.length,
		durationMs: scan.durationMs,
		scannedAt: scan.createdAt.toISOString(),
		...(probe ? { probe } : {}),
	};
};

export const getPublicScanResultHandler = async (params: {
	input: z.infer<typeof getPublicScanResultInputSchema>;
	ctx: z.infer<typeof getPublicScanResultContextSchema>;
}) => getPublicScanResultAction(params);
