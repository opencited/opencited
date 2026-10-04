import { z } from "zod";
import { baseActionContextSchema } from "../context";
import type { ScanRepository } from "./scanRepository";
import { createDrizzleScanRepository } from "./scanRepository";
import { ScanReportError } from "./scanErrors";

export const recordReportViewedInputSchema = z.object({
	scanId: z.string().uuid(),
});

export const recordReportViewedOutputSchema = z.object({
	ok: z.literal(true),
	recorded: z.boolean(),
});

export const recordReportViewedContextSchema = baseActionContextSchema.extend({
	scanRepo: z.custom<ScanRepository>().optional(),
});

export const recordReportViewedAction = async (params: {
	input: z.infer<typeof recordReportViewedInputSchema>;
	ctx: z.infer<typeof recordReportViewedContextSchema>;
}) => {
	const repo =
		params.ctx.scanRepo ?? createDrizzleScanRepository(params.ctx.db);

	const scan = await repo.getPublicScanById(params.input.scanId);
	if (!scan) {
		throw new ScanReportError("Scan not found. Run a new scan and try again.");
	}

	const verified = await repo.hasVerifiedLeadForScan(scan.id);
	if (!verified) {
		return { ok: true as const, recorded: false };
	}

	await repo.recordFunnelEventIfAbsent({
		event: "report_viewed",
		publicScanId: scan.id,
	});

	return { ok: true as const, recorded: true };
};

export const recordReportViewedHandler = async (params: {
	input: z.infer<typeof recordReportViewedInputSchema>;
	ctx: z.infer<typeof recordReportViewedContextSchema>;
}) => recordReportViewedAction(params);
