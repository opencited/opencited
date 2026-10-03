import { describe, expect, it } from "bun:test";
import type { ScanMailer } from "../src/scan/mailer";
import { requestReportAction } from "../src/scan/requestReportAction";
import { ScanReportError } from "../src/scan/scanErrors";
import { runPublicScanAction } from "../src/scan/runPublicScanAction";
import { verifyReportAction } from "../src/scan/verifyReportAction";
import { createInMemoryScanRepository } from "./helpers/inMemoryScanRepository";
import {
	brokenSiteRoutes,
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

		expect(result).toEqual({ ok: true, verificationRequired: true });
		expect(mailer.sentCodes).toHaveLength(1);
		expect(mailer.sentCodes[0]?.code).toMatch(/^\d{6}$/);
		const lead = await repo.getLeadByScanAndEmail(
			scan.scanId,
			"user@example.com",
		);
		expect(lead?.consentToOnChangeUpdates).toBe(true);
		expect(lead?.verifiedAt).toBeNull();
	});

	it("rejects report requests when the email domain does not match the scan", async () => {
		const repo = createInMemoryScanRepository();
		const now = new Date("2026-10-02T12:00:00.000Z");
		const mailer = createRecordingMailer();
		const scan = await runPublicScanAction({
			input: { domain: "oration.ai" },
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

		await expect(
			requestReportAction({
				input: {
					scanId: scan.scanId,
					email: "user@gmail.com",
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
			}),
		).rejects.toThrow(/oration\.ai/);

		expect(mailer.sentCodes).toHaveLength(0);
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
					email: `limit@site-${i}.com`,
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
					email: "limit@site-0.com",
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

	it("skips verification code when email was verified for the same domain on a prior scan", async () => {
		const repo = createInMemoryScanRepository();
		const now = new Date("2026-10-02T12:00:00.000Z");
		const mailer = createRecordingMailer();
		let lastCode = "";
		const trackingMailer: ScanMailer = {
			async sendVerificationCode(params) {
				lastCode = params.code;
				await mailer.sendVerificationCode(params);
			},
			async sendFullReport(params) {
				await mailer.sendFullReport(params);
			},
		};

		const firstScan = await runPublicScanAction({
			input: { domain: "example.com" },
			ctx: {
				userId: null,
				isAuthenticated: false,
				db: null as never,
				scanRepo: repo,
			},
			options: {
				fetcher: mockFetcher(brokenSiteRoutes()),
				lookup: publicLookup,
			},
			now: () => now,
		});

		await requestReportAction({
			input: {
				scanId: firstScan.scanId,
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
				mailer: trackingMailer,
				codeSecret: "test-secret",
			},
		});

		await verifyReportAction({
			input: {
				scanId: firstScan.scanId,
				email: "user@example.com",
				code: lastCode,
			},
			ctx: {
				userId: null,
				isAuthenticated: false,
				db: null as never,
				scanRepo: repo,
			},
			deps: {
				now: () => now,
				mailer: trackingMailer,
				codeSecret: "test-secret",
				probe: { deriveQueries: async () => [] },
			},
		});

		expect(mailer.sentCodes).toHaveLength(1);

		const secondScan = await runPublicScanAction({
			input: { domain: "example.com" },
			ctx: {
				userId: null,
				isAuthenticated: false,
				db: null as never,
				scanRepo: repo,
			},
			options: {
				fetcher: mockFetcher(brokenSiteRoutes()),
				lookup: publicLookup,
			},
			now: () => now,
		});

		const result = await requestReportAction({
			input: {
				scanId: secondScan.scanId,
				email: "user@example.com",
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
				mailer: trackingMailer,
				codeSecret: "test-secret",
				probe: {
					deriveQueries: async () => [],
					dispatchScanMentionProbe: async () => {
						throw new Error("probe dispatch disabled in test");
					},
				},
			},
		});

		expect(result.verificationRequired).toBe(false);
		if (!result.verificationRequired) {
			expect(result.report.issues.length).toBeGreaterThan(3);
			expect(result.report.issueCount).toBe(result.report.issues.length);
		}
		expect(mailer.sentCodes).toHaveLength(1);

		const lead = await repo.getLeadByScanAndEmail(
			secondScan.scanId,
			"user@example.com",
		);
		expect(lead?.verifiedAt).not.toBeNull();
		expect(lead?.reportSentAt).not.toBeNull();
	});

	it("allows trusted unlock past the daily report cap for the same email and domain", async () => {
		const repo = createInMemoryScanRepository();
		const now = new Date("2026-10-02T12:00:00.000Z");
		const mailer = createRecordingMailer();
		let lastCode = "";
		const trackingMailer: ScanMailer = {
			async sendVerificationCode(params) {
				lastCode = params.code;
				await mailer.sendVerificationCode(params);
			},
			async sendFullReport() {},
		};
		const probeDeps = {
			deriveQueries: async () => [] as string[],
			dispatchScanMentionProbe: async () => {
				throw new Error("probe dispatch disabled in test");
			},
		};

		for (let i = 0; i < 3; i++) {
			const scan = await runPublicScanAction({
				input: { domain: "example.com" },
				ctx: {
					userId: null,
					isAuthenticated: false,
					db: null as never,
					scanRepo: repo,
				},
				options: {
					fetcher: mockFetcher(brokenSiteRoutes()),
					lookup: publicLookup,
				},
				now: () => now,
			});

			await requestReportAction({
				input: {
					scanId: scan.scanId,
					email: "user@example.com",
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
					mailer: trackingMailer,
					codeSecret: "test-secret",
				},
			});

			await verifyReportAction({
				input: {
					scanId: scan.scanId,
					email: "user@example.com",
					code: lastCode,
				},
				ctx: {
					userId: null,
					isAuthenticated: false,
					db: null as never,
					scanRepo: repo,
				},
				deps: {
					now: () => now,
					mailer: trackingMailer,
					codeSecret: "test-secret",
					probe: probeDeps,
				},
			});
		}

		const fourthScan = await runPublicScanAction({
			input: { domain: "example.com" },
			ctx: {
				userId: null,
				isAuthenticated: false,
				db: null as never,
				scanRepo: repo,
			},
			options: {
				fetcher: mockFetcher(brokenSiteRoutes()),
				lookup: publicLookup,
			},
			now: () => now,
		});

		const result = await requestReportAction({
			input: {
				scanId: fourthScan.scanId,
				email: "user@example.com",
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
				mailer: trackingMailer,
				codeSecret: "test-secret",
				probe: probeDeps,
			},
		});

		expect(result.verificationRequired).toBe(false);
		if (!result.verificationRequired) {
			expect(result.report.issueCount).toBeGreaterThan(0);
		}
		expect(mailer.sentCodes).toHaveLength(1);
	});
});
