import { describe, expect, it } from "bun:test";
import type { ScanMailer } from "../src/scan/mailer";
import { recordReportViewedAction } from "../src/scan/recordReportViewedAction";
import { requestReportAction } from "../src/scan/requestReportAction";
import { runPublicScanAction } from "../src/scan/runPublicScanAction";
import { verifyReportAction } from "../src/scan/verifyReportAction";
import { createInMemoryScanRepository } from "./helpers/inMemoryScanRepository";
import {
	brokenSiteRoutes,
	mockFetcher,
	publicLookup,
} from "./helpers/scanSites";

const probeDeps = {
	deriveQueries: async () => [] as string[],
	dispatchScanMentionProbe: async () => {
		throw new Error("probe dispatch disabled in test");
	},
};

describe("recordReportViewedAction", () => {
	it("records report_viewed once for a verified scan", async () => {
		const repo = createInMemoryScanRepository();
		const now = new Date("2026-10-02T12:00:00.000Z");
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

		await verifyReportAction({
			input: {
				scanId: scan.scanId,
				email: "reader@example.com",
				code: codeMailer.lastCode ?? "",
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
				probe: probeDeps,
			},
		});

		const first = await recordReportViewedAction({
			input: { scanId: scan.scanId },
			ctx: {
				userId: null,
				isAuthenticated: false,
				db: null as never,
				scanRepo: repo,
			},
		});
		const second = await recordReportViewedAction({
			input: { scanId: scan.scanId },
			ctx: {
				userId: null,
				isAuthenticated: false,
				db: null as never,
				scanRepo: repo,
			},
		});

		expect(first).toEqual({ ok: true, recorded: true });
		expect(second).toEqual({ ok: true, recorded: true });
		const events = await repo.listFunnelEventsForScan(scan.scanId);
		expect(events.filter((row) => row.event === "report_viewed")).toHaveLength(
			1,
		);
	});

	it("does not record report_viewed without a verified lead", async () => {
		const repo = createInMemoryScanRepository();
		const now = new Date("2026-10-02T12:00:00.000Z");
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

		const result = await recordReportViewedAction({
			input: { scanId: scan.scanId },
			ctx: {
				userId: null,
				isAuthenticated: false,
				db: null as never,
				scanRepo: repo,
			},
		});

		expect(result).toEqual({ ok: true, recorded: false });
		const events = await repo.listFunnelEventsForScan(scan.scanId);
		expect(events.map((row) => row.event)).not.toContain("report_viewed");
	});
});
