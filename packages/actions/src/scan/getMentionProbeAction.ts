import { z } from "zod";
import { aiMentionProbeSchema } from "@opencited/db";
import { baseActionContextSchema } from "../context";
import type { ScanRepository } from "./scanRepository";
import { createDrizzleScanRepository } from "./scanRepository";
import { ScanReportError } from "./scanErrors";

export const getMentionProbeInputSchema = z.object({
	scanId: z.string().uuid(),
	email: z.string().trim().email(),
});

export const getMentionProbeOutputSchema = z.object({
	probe: aiMentionProbeSchema,
});

export const getMentionProbeContextSchema = baseActionContextSchema.extend({
	scanRepo: z.custom<ScanRepository>().optional(),
});

function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}

export const getMentionProbeAction = async (params: {
	input: z.infer<typeof getMentionProbeInputSchema>;
	ctx: z.infer<typeof getMentionProbeContextSchema>;
}) => {
	const repo =
		params.ctx.scanRepo ?? createDrizzleScanRepository(params.ctx.db);
	const email = normalizeEmail(params.input.email);

	const scan = await repo.getPublicScanById(params.input.scanId);
	if (!scan) {
		throw new ScanReportError("Scan not found.");
	}

	const lead = await repo.getLeadByScanAndEmail(scan.id, email);
	if (!lead?.verifiedAt) {
		throw new ScanReportError(
			"Verify your email to view the AI mention probe.",
		);
	}

	if (!scan.aiMentionProbe) {
		return { probe: { status: "unavailable" as const } };
	}

	return { probe: scan.aiMentionProbe };
};

export const getMentionProbeHandler = async (params: {
	input: z.infer<typeof getMentionProbeInputSchema>;
	ctx: z.infer<typeof getMentionProbeContextSchema>;
}) => getMentionProbeAction(params);
