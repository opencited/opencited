import { describe, expect, it } from "bun:test";
import type { ScanMailer } from "../src/scan/mailer";
import { requestReportAction } from "../src/scan/requestReportAction";
import { ScanReportError } from "../src/scan/scanErrors";
import { runPublicScanAction } from "../src/scan/runPublicScanAction";
import { createInMemoryScanRepository } from "./helpers/inMemoryScanRepository";
import {
	cleanSiteRoutes,
	mockFetcher,
	publicLookup,
} from "./helpers/scanSites";

function createRecordingMailer(): ScanMailer & {
	sentCodes: Array<{ to: string; domain: string; code: string }>;
} {
	const sentCodes: Array<{ to: string; domain: string; code: string }> = [];
	return {
		sentCodes,
		async sendVerificationCode(params) {
			sentCodes.push(params);
		},
		async sendFullReport() {},
	};
}

describe("requestReportAction", () => {
	it("stores a lead and sends a 6-digit code without returning issues", async () => {
		const repo = createInMemoryScanRepository();
		const now = new Date("2026-10-02T12:00:00.000Z");
		const mailer = createRecordingMailer();
		const scan = await runPublicScanAction({
			input: { domain: "example.com" },
			ctx: {
				userId: null,
				isAuthenticated: false,
				db: null as never,
				scanRepo: repo,
			},
			options: {
				fetcher: mockFetcher(cleanSiteRoutes()),
				lookup: publicLookup,
			},
			now: () => now,
		});

		const result = await requestReportAction({
			input: {
				scanId: scan.scanId,
				email: "user@example.com",
				consentToOnChangeUpdates: true,
			},
			ctx: {
				userId: null,
				isAuthenticated: false,
				db: null as never,
				scanRepo: repo,
			},
			deps: {
				now: () => now,
				mailer,
				codeSecret: "test-secret",
			},
		});

		expect(result).toEqual({ ok: true });
		expect(mailer.sentCodes).toHaveLength(1);
		expect(mailer.sentCodes[0]?.code).toMatch(/^\d{6}$/);
		const lead = await repo.getLeadByScanAndEmail(
			scan.scanId,
			"user@example.com",
		);
		expect(lead?.consentToOnChangeUpdates).toBe(true);
		expect(lead?.verifiedAt).toBeNull();
	});

	it("rejects the 4th full report request for the same email in 24 hours", async () => {
		const repo = createInMemoryScanRepository();
		const now = new Date("2026-10-02T12:00:00.000Z");
		const mailer = createRecordingMailer();

		for (let i = 0; i < 3; i++) {
			const scan = await runPublicScanAction({
				input: { domain: `site-${i}.com` },
				ctx: {
					userId: null,
					isAuthenticated: false,
					db: null as never,
					scanRepo: repo,
				},
				options: {
					fetcher: mockFetcher(cleanSiteRoutes(`site-${i}.com`)),
					lookup: publicLookup,
				},
				now: () => now,
			});

			await requestReportAction({
				input: {
					scanId: scan.scanId,
					email: "limit@example.com",
					consentToOnChangeUpdates: false,
				},
				ctx: {
					userId: null,
					isAuthenticated: false,
					db: null as never,
					scanRepo: repo,
				},
				deps: {
					now: () => now,
					mailer,
					codeSecret: "test-secret",
				},
			});
		}

		const fourthScan = await runPublicScanAction({
			input: { domain: "site-4.com" },
			ctx: {
				userId: null,
				isAuthenticated: false,
				db: null as never,
				scanRepo: repo,
			},
			options: {
				fetcher: mockFetcher(cleanSiteRoutes("site-4.com")),
				lookup: publicLookup,
			},
			now: () => now,
		});

		await expect(
			requestReportAction({
				input: {
					scanId: fourthScan.scanId,
					email: "limit@example.com",
					consentToOnChangeUpdates: false,
				},
				ctx: {
					userId: null,
					isAuthenticated: false,
					db: null as never,
					scanRepo: repo,
				},
				deps: {
					now: () => now,
					mailer,
					codeSecret: "test-secret",
				},
			}),
		).rejects.toBeInstanceOf(ScanReportError);

		expect(mailer.sentCodes).toHaveLength(3);
	});
});
