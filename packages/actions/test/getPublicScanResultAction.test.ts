import { describe, expect, it } from "bun:test";
import { getPublicScanResultAction } from "../src/scan/getPublicScanResultAction";
import { ScanReportError } from "../src/scan/scanErrors";
import { createInMemoryScanRepository } from "./helpers/inMemoryScanRepository";

const baseCtx = {
	userId: null,
	isAuthenticated: false,
	db: null as never,
};

describe("getPublicScanResultAction", () => {
	it("returns free-tier fields only for a stored scan", async () => {
		const repo = createInMemoryScanRepository();
		const stored = await repo.insertPublicScan({
			domain: "example.com",
			finalUrl: "https://example.com/",
			score: 42,
			readiness: "needs-work",
			issues: [
				{
					check: "robots",
					goal: "g",
					issue: "i1",
					howToFix: "f1",
					weight: 10,
				},
				{
					check: "sitemap",
					goal: "g",
					issue: "i2",
					howToFix: "f2",
					weight: 8,
				},
				{
					check: "https",
					goal: "g",
					issue: "i3",
					howToFix: "f3",
					weight: 5,
				},
				{
					check: "schema",
					goal: "g",
					issue: "i4",
					howToFix: "f4",
					weight: 3,
				},
			],
			durationMs: 1200,
			homepageSnapshot: {
				title: "Secret",
				metaDescription: null,
				h1: null,
				brandName: null,
				textExcerpt: "homepage text",
			},
		});

		const result = await getPublicScanResultAction({
			input: stored.id,
			ctx: { ...baseCtx, scanRepo: repo },
		});

		expect(result).toEqual({
			scanId: stored.id,
			domain: "example.com",
			finalUrl: "https://example.com/",
			score: 42,
			readiness: "needs-work",
			issues: [
				{
					check: "robots",
					goal: "g",
					issue: "i1",
					howToFix: "f1",
					weight: 10,
				},
				{
					check: "sitemap",
					goal: "g",
					issue: "i2",
					howToFix: "f2",
					weight: 8,
				},
				{
					check: "https",
					goal: "g",
					issue: "i3",
					howToFix: "f3",
					weight: 5,
				},
			],
			issueCount: 4,
			durationMs: 1200,
			scannedAt: stored.createdAt.toISOString(),
		});
	});

	it("omits probe when none is stored or probe is not finished", async () => {
		const repo = createInMemoryScanRepository();
		const stored = await repo.insertPublicScan({
			domain: "pending.com",
			finalUrl: "https://pending.com/",
			score: 50,
			readiness: "needs-work",
			issues: [],
			durationMs: 1000,
		});
		await repo.setPublicScanProbePending(stored.id, {
			status: "pending",
			queries: ["q1"],
		});

		const pending = await getPublicScanResultAction({
			input: stored.id,
			ctx: { ...baseCtx, scanRepo: repo },
		});
		expect(pending.probe).toBeUndefined();

		await repo.updatePublicScanProbe(stored.id, {
			aiMentionProbe: { status: "unavailable" },
			probeCompletedAt: new Date(),
		});
		const unavailable = await getPublicScanResultAction({
			input: stored.id,
			ctx: { ...baseCtx, scanRepo: repo },
		});
		expect(unavailable.probe).toBeUndefined();
	});

	it("includes cached ok probe results without other gated fields", async () => {
		const repo = createInMemoryScanRepository();
		const stored = await repo.insertPublicScan({
			domain: "visible.com",
			finalUrl: "https://visible.com/",
			score: 80,
			readiness: "ready",
			issues: [],
			durationMs: 900,
			homepageSnapshot: {
				title: "Secret",
				metaDescription: null,
				h1: null,
				brandName: null,
				textExcerpt: "hidden",
			},
		});
		const okProbe = {
			status: "ok" as const,
			queries: [
				{
					query: "best widgets",
					visibility: "visible" as const,
					excerpt: "Visible.com makes widgets.",
					citationUrls: ["https://visible.com/"],
				},
			],
		};
		await repo.updatePublicScanProbe(stored.id, {
			aiMentionProbe: okProbe,
			probeCompletedAt: new Date(),
		});

		const result = await getPublicScanResultAction({
			input: stored.id,
			ctx: { ...baseCtx, scanRepo: repo },
		});

		expect(result.probe).toEqual(okProbe);
		expect(result).not.toHaveProperty("homepageSnapshot");
	});

	it("throws when the scan id is unknown", async () => {
		const repo = createInMemoryScanRepository();
		await expect(
			getPublicScanResultAction({
				input: "550e8400-e29b-41d4-a716-446655440000",
				ctx: { ...baseCtx, scanRepo: repo },
			}),
		).rejects.toThrow(ScanReportError);
	});
});
