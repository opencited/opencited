import { z } from "zod";
import { baseActionContextSchema } from "../context";
import type { ScanRepository } from "./scanRepository";
import { createDrizzleScanRepository } from "./scanRepository";
import { ScanReportError } from "./scanErrors";
import type { ScanMailer } from "./mailer";
import { env } from "../env";
import { createResendScanMailer } from "./reportEmails";
import {
	hashVerificationCode,
	MAX_VERIFICATION_ATTEMPTS,
} from "./verificationCode";
import { aiMentionProbeSchema } from "@opencited/db";
import {
	prepareProbeForVerify,
	type CategoryQueryDeriver,
	type ScanMentionProbeDispatcher,
} from "./aiMentionProbe";
import { scanIssueSchema } from "./runScanAction";
import { buildVerifyPayload, unlockScanReport } from "./unlockScanReport";

export const verifyReportInputSchema = z.object({
	scanId: z.string().uuid(),
	email: z.string().trim().email("Enter a valid email address."),
	code: z
		.string()
		.trim()
		.regex(/^\d{6}$/, "Enter the 6-digit code from your email."),
});

export const verifyReportOutputSchema = z.object({
	domain: z.string(),
	finalUrl: z.string(),
	score: z.number().int().min(0).max(100),
	readiness: z.enum(["ready", "needs-work", "not-ready"]),
	issues: z.array(scanIssueSchema),
	issueCount: z.number().int().min(0),
	durationMs: z.number().int().min(0),
	probe: aiMentionProbeSchema,
});

export const verifyReportContextSchema = baseActionContextSchema.extend({
	scanRepo: z.custom<ScanRepository>().optional(),
});

function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}

export const verifyReportAction = async (params: {
	input: z.infer<typeof verifyReportInputSchema>;
	ctx: z.infer<typeof verifyReportContextSchema>;
	deps?: {
		now?: () => Date;
		mailer?: ScanMailer;
		codeSecret?: string;
		probe?: {
			deriveQueries?: CategoryQueryDeriver;
			dispatchScanMentionProbe?: ScanMentionProbeDispatcher;
		};
	};
}) => {
	const repo =
		params.ctx.scanRepo ?? createDrizzleScanRepository(params.ctx.db);
	const now = params.deps?.now?.() ?? new Date();
	const mailer = params.deps?.mailer ?? createResendScanMailer();
	const codeSecret = params.deps?.codeSecret ?? env.SCAN_CODE_SECRET;
	const probeDeps = params.deps?.probe ?? {};

	const email = normalizeEmail(params.input.email);
	const scan = await repo.getPublicScanById(params.input.scanId);
	if (!scan) {
		throw new ScanReportError("Scan not found. Run a new scan and try again.");
	}

	const lead = await repo.getLeadByScanAndEmail(scan.id, email);
	if (!lead) {
		throw new ScanReportError(
			"No verification request found. Enter your email to get a code.",
		);
	}

	if (lead.verifiedAt) {
		const probe = await prepareProbeForVerify({
			scan,
			repo,
			now: () => now,
			deps: probeDeps,
		});
		return buildVerifyPayload(scan, probe);
	}

	if (lead.attemptCount >= MAX_VERIFICATION_ATTEMPTS) {
		throw new ScanReportError(
			"Too many incorrect attempts. Request a new code.",
		);
	}

	if (lead.codeExpiresAt.getTime() <= now.getTime()) {
		throw new ScanReportError("Verification code expired. Request a new code.");
	}

	const expectedHash = hashVerificationCode(params.input.code, codeSecret);
	if (expectedHash !== lead.codeHash) {
		const nextAttempts = lead.attemptCount + 1;
		await repo.updateLead(lead.id, { attemptCount: nextAttempts });
		throw new ScanReportError("Incorrect verification code.");
	}

	const report = await unlockScanReport({
		scan,
		lead,
		email,
		repo,
		now,
		mailer,
		probeDeps,
		options: {
			sendFullReportEmail: true,
			joinWaitlist: true,
		},
	});

	await repo.recordFunnelEventIfAbsent({
		event: "email_verified",
		publicScanId: scan.id,
	});

	return report;
};

export const verifyReportHandler = async (params: {
	input: z.infer<typeof verifyReportInputSchema>;
	ctx: z.infer<typeof verifyReportContextSchema>;
}) => verifyReportAction(params);
