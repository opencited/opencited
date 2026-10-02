import { describe, expect, it } from "bun:test";
import { runPublicScanAction } from "../src/scan/runPublicScanAction";
import { ScanReportError } from "../src/scan/scanErrors";
import { createInMemoryScanRepository } from "./helpers/inMemoryScanRepository";
import {
	cleanSiteRoutes,
	mockFetcher,
	publicLookup,
} from "./helpers/scanSites";

describe("runPublicScanAction", () => {
	it("stores the full issue list and returns scanId with only the free tier issues", async () => {
		const repo = createInMemoryScanRepository();

		const baseCtx = {
			userId: null,
			isAuthenticated: false,
			db: null as never,
			scanRepo: repo,
			clientIp: "203.0.113.1",
		};

		const result = await runPublicScanAction({
			input: { domain: "example.com" },
			ctx: baseCtx,
			options: {
				fetcher: mockFetcher(cleanSiteRoutes()),
				lookup: publicLookup,
			},
			now: () => new Date("2026-10-02T12:00:00.000Z"),
		});

		expect(result.scanId).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
		);
		expect(result.issues).toHaveLength(0);
		const stored = await repo.getPublicScanById(result.scanId);
		expect(stored?.issues).toEqual([]);
	});

	it("rejects the 11th scan from the same IP within 24 hours before running the scan", async () => {
		const repo = createInMemoryScanRepository();
		const now = new Date("2026-10-02T12:00:00.000Z");
		const clientIp = "203.0.113.9";

		const baseCtx = {
			userId: null,
			isAuthenticated: false,
			db: null as never,
			scanRepo: repo,
			clientIp,
		};

		for (let i = 0; i < 10; i++) {
			await runPublicScanAction({
				input: { domain: "example.com" },
				ctx: baseCtx,
				options: {
					fetcher: mockFetcher(cleanSiteRoutes(`example-${i}.com`)),
					lookup: publicLookup,
				},
				now: () => now,
			});
		}

		let thrown: unknown;
		try {
			await runPublicScanAction({
				input: { domain: "example.com" },
				ctx: baseCtx,
				options: {
					fetcher: mockFetcher(cleanSiteRoutes("blocked.com")),
					lookup: publicLookup,
				},
				now: () => now,
			});
		} catch (error) {
			thrown = error;
		}

		expect(thrown).toBeInstanceOf(ScanReportError);
		expect((thrown as Error).message).toContain("Too many scans");
		const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
		expect(await repo.countScansByIpSince(clientIp, since)).toBe(10);
	});
});
