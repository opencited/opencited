import { describe, expect, it } from "bun:test";
import type { ScanMailer } from "../src/scan/mailer";
import { sendMentionProbeReportEmails } from "../src/scan/sendMentionProbeReportEmails";
import { createInMemoryScanRepository } from "./helpers/inMemoryScanRepository";

function createRecordingMailer(): ScanMailer & {
	calls: Array<{ to: string; visibilityUpdate?: boolean; probeStatus: string }>;
} {
	const calls: Array<{
		to: string;
		visibilityUpdate?: boolean;
		probeStatus: string;
	}> = [];
	return {
		calls,
		async sendVerificationCode() {},
		async sendFullReport(params) {
			calls.push({
				to: params.to,
				visibilityUpdate: params.visibilityUpdate,
				probeStatus: params.probe.status,
			});
		},
	};
}

describe("sendMentionProbeReportEmails", () => {
	it("emails verified leads when probe finishes ok", async () => {
		const repo = createInMemoryScanRepository();
		const mailer = createRecordingMailer();
		const now = new Date("2026-10-03T12:00:00.000Z");

		const scan = await repo.insertPublicScan({
			domain: "example.com",
			finalUrl: "https://example.com",
			score: 90,
			readiness: "ready",
			issues: [],
			durationMs: 100,
		});
		await repo.updatePublicScanProbe(scan.id, {
			aiMentionProbe: {
				status: "ok",
				queries: [
					{
						query: "best widgets",
						visibility: "visible",
						excerpt: "Example Corp makes widgets.",
						citationUrls: ["https://example.com"],
					},
				],
			},
			probeCompletedAt: now,
		});

		const lead = await repo.insertLead({
			email: "reader@example.com",
			domain: "example.com",
			publicScanId: scan.id,
			consentToOnChangeUpdates: true,
			codeHash: "hash",
			codeExpiresAt: now,
		});
		await repo.updateLead(lead.id, {
			verifiedAt: now,
			reportSentAt: now,
		});

		const { sent } = await sendMentionProbeReportEmails({
			publicScanId: scan.id,
			db: null as never,
			scanRepo: repo,
			mailer,
			now: () => now,
		});

		expect(sent).toBe(1);
		expect(mailer.calls).toHaveLength(1);
		expect(mailer.calls[0]?.visibilityUpdate).toBe(true);
		expect(mailer.calls[0]?.probeStatus).toBe("ok");

		const updated = await repo.getLeadByScanAndEmail(
			scan.id,
			"reader@example.com",
		);
		expect(updated?.probeReportSentAt).toEqual(now);
	});

	it("skips leads who already received visibility in the first email", async () => {
		const repo = createInMemoryScanRepository();
		const mailer = createRecordingMailer();
		const now = new Date("2026-10-03T12:00:00.000Z");

		const scan = await repo.insertPublicScan({
			domain: "example.com",
			finalUrl: "https://example.com",
			score: 90,
			readiness: "ready",
			issues: [],
			durationMs: 100,
		});
		await repo.updatePublicScanProbe(scan.id, {
			aiMentionProbe: { status: "ok", queries: [] },
			probeCompletedAt: now,
		});

		const lead = await repo.insertLead({
			email: "reader@example.com",
			domain: "example.com",
			publicScanId: scan.id,
			consentToOnChangeUpdates: false,
			codeHash: "hash",
			codeExpiresAt: now,
		});
		await repo.updateLead(lead.id, {
			verifiedAt: now,
			reportSentAt: now,
			probeReportSentAt: now,
		});

		const { sent } = await sendMentionProbeReportEmails({
			publicScanId: scan.id,
			db: null as never,
			scanRepo: repo,
			mailer,
		});

		expect(sent).toBe(0);
		expect(mailer.calls).toHaveLength(0);
	});
});
