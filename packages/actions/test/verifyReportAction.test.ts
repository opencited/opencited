import { describe, expect, it } from "bun:test";
import type { ScanMailer } from "../src/scan/mailer";
import { requestReportAction } from "../src/scan/requestReportAction";
import { runPublicScanAction } from "../src/scan/runPublicScanAction";
import { ScanReportError } from "../src/scan/scanErrors";
import { verifyReportAction } from "../src/scan/verifyReportAction";
import { VERIFICATION_CODE_TTL_MS } from "../src/scan/verificationCode";
import { createInMemoryScanRepository } from "./helpers/inMemoryScanRepository";
import {
	brokenSiteRoutes,
	mockFetcher,
	publicLookup,
} from "./helpers/scanSites";

function createRecordingMailer(): ScanMailer & {
	reports: Array<{ to: string; domain: string }>;
} {
	const reports: Array<{ to: string; domain: string }> = [];
	return {
		reports,
		async sendVerificationCode() {},
		async sendFullReport(params) {
			reports.push({ to: params.to, domain: params.domain });
		},
	};
}

const unavailableProbeDeps = {
	deriveQueries: async () => [] as string[],
	dispatchScanMentionProbe: async () => {
		throw new Error("probe dispatch disabled in test");
	},
};

async function setupVerifiedFlow() {
	const repo = createInMemoryScanRepository();
	const now = new Date("2026-10-02T12:00:00.000Z");
	const mailer = createRecordingMailer();
	const codeMailer: ScanMailer & { lastCode?: string } = {
		async sendVerificationCode({ code }) {
			codeMailer.lastCode = code;
		},
		async sendFullReport() {},
	};

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
			email: "reader@example.com",
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
			mailer: codeMailer,
			codeSecret: "test-secret",
		},
	});

	return {
		repo,
		now,
		mailer,
		scan,
		code: codeMailer.lastCode ?? "",
	};
}

describe("verifyReportAction", () => {
	it("returns all issues only after a valid code and emails the report", async () => {
		const { repo, now, mailer, scan, code } = await setupVerifiedFlow();

		const result = await verifyReportAction({
			input: {
				scanId: scan.scanId,
				email: "reader@example.com",
				code,
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
				probe: unavailableProbeDeps,
			},
		});

		expect(result.probe).toEqual({ status: "unavailable" });
		expect(result.issues.length).toBeGreaterThan(3);
		expect(result.issueCount).toBe(result.issues.length);
		expect(mailer.reports).toHaveLength(1);
		const lead = await repo.getLeadByScanAndEmail(
			scan.scanId,
			"reader@example.com",
		);
		expect(lead?.verifiedAt).not.toBeNull();
		expect(lead?.reportSentAt).not.toBeNull();
		const events = await repo.listFunnelEventsForScan(scan.scanId);
		expect(events.map((row) => row.event)).toContain("email_verified");
	});

	it("dispatches a browser probe and returns pending when queries survive", async () => {
		const { repo, now, mailer, scan, code } = await setupVerifiedFlow();
		const dispatches: unknown[] = [];

		const result = await verifyReportAction({
			input: {
				scanId: scan.scanId,
				email: "reader@example.com",
				code,
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
				probe: {
					deriveQueries: async () => ["best project tools"],
					dispatchScanMentionProbe: async (payload) => {
						dispatches.push(payload);
					},
				},
			},
		});

		expect(result.probe).toEqual({
			status: "pending",
			queries: ["best project tools"],
		});
		expect(dispatches).toHaveLength(1);
		expect(mailer.reports).toHaveLength(1);
	});

	it("rejects expired and incorrect codes without returning issues", async () => {
		const { repo, now, mailer, scan, code } = await setupVerifiedFlow();

		await expect(
			verifyReportAction({
				input: {
					scanId: scan.scanId,
					email: "reader@example.com",
					code: "000000",
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
					probe: unavailableProbeDeps,
				},
			}),
		).rejects.toBeInstanceOf(ScanReportError);

		const expiredAt = new Date(now.getTime() + VERIFICATION_CODE_TTL_MS + 1);
		await expect(
			verifyReportAction({
				input: {
					scanId: scan.scanId,
					email: "reader@example.com",
					code,
				},
				ctx: {
					userId: null,
					isAuthenticated: false,
					db: null as never,
					scanRepo: repo,
				},
				deps: {
					now: () => expiredAt,
					mailer,
					codeSecret: "test-secret",
					probe: unavailableProbeDeps,
				},
			}),
		).rejects.toBeInstanceOf(ScanReportError);
	});
});
