import { runTechnicalScan, type ScanOptions } from "@opencited/scanner";
import { z } from "zod";
import { baseActionContextSchema } from "../context";
import type { ScanRepository } from "./scanRepository";
import { ScanReportError } from "./scanErrors";
import {
	FREE_ISSUE_LIMIT,
	getReadinessLevel,
	type runScanInputSchema,
	runScanOutputSchema,
} from "./runScanAction";
import { createDrizzleScanRepository } from "./scanRepository";

export const MAX_SCANS_PER_IP_PER_DAY = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

export const runPublicScanContextSchema = baseActionContextSchema.extend({
	clientIp: z.string().optional(),
	scanRepo: z.custom<ScanRepository>().optional(),
});

export const runPublicScanOutputSchema = runScanOutputSchema.extend({
	scanId: z.string().uuid(),
});

export const runPublicScanAction = async (params: {
	input: z.infer<typeof runScanInputSchema>;
	ctx: z.infer<typeof runPublicScanContextSchema>;
	options?: ScanOptions;
	now?: () => Date;
}): Promise<z.infer<typeof runPublicScanOutputSchema>> => {
	const repo =
		params.ctx.scanRepo ?? createDrizzleScanRepository(params.ctx.db);
	const now = params.now?.() ?? new Date();
	const clientIp = params.ctx.clientIp;

	if (clientIp) {
		const since = new Date(now.getTime() - DAY_MS);
		const count = await repo.countScansByIpSince(clientIp, since);
		if (count >= MAX_SCANS_PER_IP_PER_DAY) {
			throw new ScanReportError(
				"Too many scans from this connection today. Please try again tomorrow.",
			);
		}
	}

	const started = await repo.insertFunnelEvent({
		event: "scan_started",
		publicScanId: null,
	});

	const technical = await runTechnicalScan(params.input.domain, params.options);

	const stored = await repo.insertPublicScan({
		domain: technical.domain,
		finalUrl: technical.finalUrl,
		score: technical.score,
		readiness: getReadinessLevel(technical.score),
		issues: technical.issues,
		durationMs: technical.durationMs,
		clientIp,
		homepageSnapshot: technical.homepageSnapshot,
	});

	await repo.linkFunnelEventToScan(started.id, stored.id);
	await repo.recordFunnelEventIfAbsent({
		event: "score_shown",
		publicScanId: stored.id,
	});

	return {
		domain: technical.domain,
		finalUrl: technical.finalUrl,
		score: technical.score,
		readiness: getReadinessLevel(technical.score),
		issues: technical.issues.slice(0, FREE_ISSUE_LIMIT),
		issueCount: technical.issues.length,
		durationMs: technical.durationMs,
		scanId: stored.id,
	};
};

export const runPublicScanHandler = async (params: {
	input: z.infer<typeof runScanInputSchema>;
	ctx: z.infer<typeof runPublicScanContextSchema>;
	options?: ScanOptions;
}) => runPublicScanAction(params);
