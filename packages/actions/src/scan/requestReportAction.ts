import { z } from "zod";
import { baseActionContextSchema } from "../context";
import type { ScanRepository } from "./scanRepository";
import { createDrizzleScanRepository } from "./scanRepository";
import { ScanReportError } from "./scanErrors";
import type { ScanMailer } from "./mailer";
import { env } from "../env";
import { createResendScanMailer } from "./reportEmails";
import {
	generateVerificationCode,
	hashVerificationCode,
	verificationCodeExpiresAt,
} from "./verificationCode";
import {
	emailMatchesScanDomain,
	emailHostForScanDomain,
} from "./reportEmailDomain";
import { verifyReportOutputSchema } from "./verifyReportAction";
import { unlockScanReport } from "./unlockScanReport";
import type {
	CategoryQueryDeriver,
	ScanMentionProbeDispatcher,
} from "./aiMentionProbe";

export const MAX_REPORTS_PER_EMAIL_PER_DAY = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

export const requestReportInputSchema = z.object({
	scanId: z.string().uuid(),
	email: z.string().trim().email("Enter a valid email address."),
	consentToOnChangeUpdates: z.boolean(),
});

export const requestReportOutputSchema = z.discriminatedUnion(
	"verificationRequired",
	[
		z.object({
			ok: z.literal(true),
			verificationRequired: z.literal(true),
		}),
		z.object({
			ok: z.literal(true),
			verificationRequired: z.literal(false),
			report: verifyReportOutputSchema,
		}),
	],
);

export const requestReportContextSchema = baseActionContextSchema.extend({
	scanRepo: z.custom<ScanRepository>().optional(),
});

function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}

export const requestReportAction = async (params: {
	input: z.infer<typeof requestReportInputSchema>;
	ctx: z.infer<typeof requestReportContextSchema>;
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

	if (!emailMatchesScanDomain(email, scan.domain)) {
		const requiredHost = emailHostForScanDomain(scan.domain);
		throw new ScanReportError(
			`Use a work email at ${requiredHost} to unlock this report.`,
		);
	}

	const scanAgeMs = now.getTime() - scan.createdAt.getTime();
	if (scanAgeMs > DAY_MS) {
		throw new ScanReportError("This scan has expired. Run a new scan.");
	}

	let existingLead = await repo.getLeadByScanAndEmail(scan.id, email);

	const trustedUnlock =
		Boolean(existingLead?.verifiedAt) ||
		(await repo.hasVerifiedLeadForEmailAndDomain(email, scan.domain));

	if (!existingLead && !trustedUnlock) {
		const since = new Date(now.getTime() - DAY_MS);
		const leadCount = await repo.countLeadsByEmailSince(email, since);
		if (leadCount >= MAX_REPORTS_PER_EMAIL_PER_DAY) {
			throw new ScanReportError(
				"Too many full reports for this email today. Please try again tomorrow.",
			);
		}
	}

	if (trustedUnlock) {
		const code = generateVerificationCode();
		const codeHash = hashVerificationCode(code, codeSecret);
		const codeExpiresAt = verificationCodeExpiresAt(now);

		if (existingLead) {
			await repo.updateLead(existingLead.id, {
				consentToOnChangeUpdates: params.input.consentToOnChangeUpdates,
			});
		} else {
			existingLead = await repo.insertLead({
				email,
				domain: scan.domain,
				publicScanId: scan.id,
				consentToOnChangeUpdates: params.input.consentToOnChangeUpdates,
				codeHash,
				codeExpiresAt,
			});
		}

		if (!existingLead) {
			throw new ScanReportError(
				"Scan not found. Run a new scan and try again.",
			);
		}

		const report = await unlockScanReport({
			scan,
			lead: existingLead,
			email,
			repo,
			now,
			mailer,
			probeDeps,
			options: {
				sendFullReportEmail: false,
				joinWaitlist: false,
			},
		});

		return {
			ok: true as const,
			verificationRequired: false as const,
			report,
		};
	}

	const code = generateVerificationCode();
	const codeHash = hashVerificationCode(code, codeSecret);
	const codeExpiresAt = verificationCodeExpiresAt(now);

	if (existingLead) {
		await repo.updateLead(existingLead.id, {
			consentToOnChangeUpdates: params.input.consentToOnChangeUpdates,
			codeHash,
			codeExpiresAt,
			attemptCount: 0,
		});
	} else {
		await repo.insertLead({
			email,
			domain: scan.domain,
			publicScanId: scan.id,
			consentToOnChangeUpdates: params.input.consentToOnChangeUpdates,
			codeHash,
			codeExpiresAt,
		});
	}

	await mailer.sendVerificationCode({
		to: email,
		domain: scan.domain,
		code,
	});

	return {
		ok: true as const,
		verificationRequired: true as const,
	};
};

export const requestReportHandler = async (params: {
	input: z.infer<typeof requestReportInputSchema>;
	ctx: z.infer<typeof requestReportContextSchema>;
}) => requestReportAction(params);
