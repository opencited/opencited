import { describe, expect, it } from "bun:test";
import { prepareProbeForVerify } from "../src/scan/aiMentionProbe/prepareProbeForVerify";
import { createInMemoryScanRepository } from "./helpers/inMemoryScanRepository";
import type { HomepageSnapshot } from "../src/scan/aiMentionProbe/types";

const snapshot: HomepageSnapshot = {
	title: "Acme",
	metaDescription: "Widgets",
	h1: "Welcome",
	brandName: "Acme",
	textExcerpt: "We build widgets for teams.",
};

describe("prepareProbeForVerify", () => {
	it("stores pending and dispatches when queries survive the filter", async () => {
		const repo = createInMemoryScanRepository();
		const scan = await repo.insertPublicScan({
			domain: "acme.com",
			finalUrl: "https://acme.com",
			score: 80,
			readiness: "ready",
			issues: [],
			durationMs: 100,
			homepageSnapshot: snapshot,
		});
		const dispatches: unknown[] = [];

		const probe = await prepareProbeForVerify({
			scan,
			repo,
			now: () => new Date("2026-10-03T00:00:00Z"),
			deps: {
				deriveQueries: async () => [
					"best widget platform",
					"acme widgets review",
				],
				dispatchScanMentionProbe: async (payload) => {
					dispatches.push(payload);
				},
			},
		});

		expect(probe).toEqual({ status: "pending" });
		expect(dispatches).toHaveLength(1);
		const stored = await repo.getPublicScanById(scan.id);
		expect(stored?.aiMentionProbe).toEqual({ status: "pending" });
		expect(stored?.probeCompletedAt).toBeNull();
	});

	it("marks unavailable when dispatch fails", async () => {
		const repo = createInMemoryScanRepository();
		const now = new Date("2026-10-03T00:00:00Z");
		const scan = await repo.insertPublicScan({
			domain: "acme.com",
			finalUrl: "https://acme.com",
			score: 80,
			readiness: "ready",
			issues: [],
			durationMs: 100,
			homepageSnapshot: snapshot,
		});

		const probe = await prepareProbeForVerify({
			scan,
			repo,
			now: () => now,
			deps: {
				deriveQueries: async () => ["best widget platform"],
				dispatchScanMentionProbe: async () => {
					throw new Error("redis down");
				},
			},
		});

		expect(probe).toEqual({ status: "unavailable" });
		const stored = await repo.getPublicScanById(scan.id);
		expect(stored?.aiMentionProbe).toEqual({ status: "unavailable" });
		expect(stored?.probeCompletedAt).toEqual(now);
	});

	it("falls back to homepage-based queries when derivation throws", async () => {
		const repo = createInMemoryScanRepository();
		const scan = await repo.insertPublicScan({
			domain: "convoform.com",
			finalUrl: "https://convoform.com",
			score: 75,
			readiness: "ready",
			issues: [],
			durationMs: 100,
			homepageSnapshot: {
				title: "ConvoForm | Create Conversational Forms",
				metaDescription:
					"Transform your standard forms into engaging conversations with ConvoForm.",
				h1: "Turn Static Forms Into Smart ConvoForms",
				brandName: null,
				textExcerpt: "ConvoForm documentation sign in",
			},
		});
		const dispatches: unknown[] = [];

		const probe = await prepareProbeForVerify({
			scan,
			repo,
			now: () => new Date("2026-10-03T00:00:00Z"),
			deps: {
				deriveQueries: async () => {
					throw new Error("model not found");
				},
				dispatchScanMentionProbe: async (payload) => {
					dispatches.push(payload);
				},
			},
		});

		expect(probe).toEqual({ status: "pending" });
		expect(dispatches).toHaveLength(1);
	});
});
