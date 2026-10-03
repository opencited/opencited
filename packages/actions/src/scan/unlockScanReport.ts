import type { aiMentionProbeSchema } from "@opencited/db";
import type { z } from "zod";
import {
	prepareProbeForVerify,
	type CategoryQueryDeriver,
	type ScanMentionProbeDispatcher,
} from "./aiMentionProbe";
import { joinClerkWaitlist } from "./joinWaitlist";
import type { ScanMailer } from "./mailer";
import type {
	ScanRepository,
	StoredPublicScan,
	StoredScanLead,
} from "./scanRepository";

export function buildVerifyPayload(
	scan: StoredPublicScan,
	probe: z.infer<typeof aiMentionProbeSchema>,
) {
	return {
		domain: scan.domain,
		finalUrl: scan.finalUrl,
		score: scan.score,
		readiness: scan.readiness as "ready" | "needs-work" | "not-ready",
		issues: scan.issues,
		issueCount: scan.issues.length,
		durationMs: scan.durationMs,
		probe,
	};
}

export async function unlockScanReport(params: {
	scan: StoredPublicScan;
	lead: StoredScanLead;
	email: string;
	repo: ScanRepository;
	now: Date;
	mailer: ScanMailer;
	probeDeps?: {
		deriveQueries?: CategoryQueryDeriver;
		dispatchScanMentionProbe?: ScanMentionProbeDispatcher;
	};
	options: {
		sendFullReportEmail: boolean;
		joinWaitlist: boolean;
	};
}) {
	const probe = await prepareProbeForVerify({
		scan: params.scan,
		repo: params.repo,
		now: () => params.now,
		deps: params.probeDeps,
	});

	if (!params.lead.verifiedAt) {
		await params.repo.updateLead(params.lead.id, {
			verifiedAt: params.now,
			consentToOnChangeUpdates: params.lead.consentToOnChangeUpdates,
		});
	}

	if (params.options.sendFullReportEmail) {
		await params.mailer.sendFullReport({
			to: params.email,
			domain: params.scan.domain,
			score: params.scan.score,
			readiness: params.scan.readiness,
			issues: params.scan.issues,
			probe,
		});
		await params.repo.updateLead(params.lead.id, {
			reportSentAt: params.now,
			...(probe.status !== "pending" ? { probeReportSentAt: params.now } : {}),
		});
		if (params.options.joinWaitlist) {
			await joinClerkWaitlist(params.email);
		}
	} else if (!params.lead.reportSentAt) {
		await params.repo.updateLead(params.lead.id, {
			reportSentAt: params.now,
			...(probe.status !== "pending" ? { probeReportSentAt: params.now } : {}),
		});
	}

	return buildVerifyPayload(params.scan, probe);
}
