import type { Db } from "@opencited/db";
import { createResendScanMailer } from "./reportEmails";
import type { ScanMailer } from "./mailer";
import {
	createDrizzleScanRepository,
	type ScanRepository,
} from "./scanRepository";

export async function sendMentionProbeReportEmails(params: {
	publicScanId: string;
	db: Db;
	mailer?: ScanMailer;
	scanRepo?: ScanRepository;
	now?: () => Date;
}): Promise<{ sent: number }> {
	const repo = params.scanRepo ?? createDrizzleScanRepository(params.db);
	const mailer = params.mailer ?? createResendScanMailer();
	const now = params.now ?? (() => new Date());

	const scan = await repo.getPublicScanById(params.publicScanId);
	if (!scan?.aiMentionProbe) {
		return { sent: 0 };
	}
	const probe = scan.aiMentionProbe;
	if (probe.status === "pending") {
		return { sent: 0 };
	}

	const leads = await repo.listLeadsNeedingProbeReport(params.publicScanId);
	let sent = 0;
	for (const lead of leads) {
		await mailer.sendFullReport({
			to: lead.email,
			domain: scan.domain,
			score: scan.score,
			readiness: scan.readiness,
			issues: scan.issues,
			probe,
			visibilityUpdate: true,
		});
		await repo.updateLead(lead.id, { probeReportSentAt: now() });
		sent += 1;
	}
	return { sent };
}
