import { beforeEach, describe, expect, it, mock } from "bun:test";

function makeChain(result: unknown) {
	const chain: Record<string, unknown> = {};
	chain.from = mock(() => chain);
	chain.where = mock(() => chain);
	chain.limit = mock(async () => result);
	chain.orderBy = mock(async () => result);
	// biome-ignore lint/suspicious/noThenProperty: Mock chain needs thenable for `await where(...)`
	chain.then = (resolve: (v: unknown) => void) => resolve(result);
	return chain;
}

function makeDb() {
	let selectCalls = 0;
	const selectResults: unknown[][] = [];
	const capturedValues: unknown[][] = [];

	return {
		select: mock(() => {
			const result = selectResults[selectCalls++] ?? [];
			return makeChain(result);
		}),
		insert: mock(() => ({
			values: mock(async (vals: unknown[]) => {
				capturedValues.push(vals);
			}),
		})),
		update: mock(() => ({
			set: mock(() => ({
				where: mock(async () => {}),
			})),
		})),
		__setupSelect: (results: unknown[][]) => {
			selectCalls = 0;
			selectResults.length = 0;
			selectResults.push(...results);
		},
		__getCapturedValues: () => capturedValues,
	};
}

import { saveInlineLinksAction } from "../src/promptQueryCrawl/saveInlineLinksAction";

function makeCtx(db: ReturnType<typeof makeDb>) {
	return { userId: null, isAuthenticated: false, db };
}

describe("saveInlineLinksAction", () => {
	let db: ReturnType<typeof makeDb>;

	beforeEach(() => {
		db = makeDb();
	});

	it("inserts inline links into crawl_reference with kind='inline-link'", async () => {
		db.__setupSelect([
			[{ id: "crawl-1", promptQueryId: "pq-1" }],
			[{ id: "pq-1", domainProjectId: "dp-1" }],
			[],
			[{ id: "dp-1", domain: "mybrand.com" }],
		]);

		const result = await saveInlineLinksAction({
			input: {
				crawlId: "crawl-1",
				promptQueryId: "pq-1",
				domainProjectId: "dp-1",
				inlineLinks: [
					{
						title: "Acme Article",
						url: "https://acme.com/article",
						domain: "acme.com",
						position: 1,
					},
					{
						title: "Beta Guide",
						url: "https://beta.com/guide",
						domain: "beta.com",
						position: 2,
					},
				],
				sourcePanelLinks: [],
			},
			ctx: makeCtx(db),
		});

		expect(result.linksSaved).toBe(2);
		expect(db.insert).toHaveBeenCalledTimes(1);
		const capturedValues = db.__getCapturedValues();
		expect(capturedValues).toHaveLength(1);
		expect(capturedValues[0]).toHaveLength(2);

		const first = capturedValues[0]?.[0] as Record<string, unknown>;
		expect(first.kind).toBe("inline-link");
		expect(first.domain).toBe("acme.com");
		expect(first.title).toBe("Acme Article");
		expect(first.position).toBe(1);

		const second = capturedValues[0]?.[1] as Record<string, unknown>;
		expect(second.kind).toBe("inline-link");
		expect(second.domain).toBe("beta.com");
	});

	it("marks own domain correctly", async () => {
		db.__setupSelect([
			[{ id: "crawl-1", promptQueryId: "pq-1" }],
			[{ id: "pq-1", domainProjectId: "dp-1" }],
			[],
			[{ id: "dp-1", domain: "mybrand.com" }],
		]);

		await saveInlineLinksAction({
			input: {
				crawlId: "crawl-1",
				promptQueryId: "pq-1",
				domainProjectId: "dp-1",
				inlineLinks: [
					{
						title: "MyBrand",
						url: "https://mybrand.com/page",
						domain: "mybrand.com",
						position: 1,
					},
				],
				sourcePanelLinks: [],
			},
			ctx: makeCtx(db),
		});

		const capturedValues = db.__getCapturedValues();
		const row = capturedValues[0]?.[0] as Record<string, unknown>;
		expect(row.isOwnDomain).toBe("true");
	});

	it("marks competitor domains correctly", async () => {
		db.__setupSelect([
			[{ id: "crawl-1", promptQueryId: "pq-1" }],
			[{ id: "pq-1", domainProjectId: "dp-1" }],
			[{ domain: "acme.com" }],
			[{ id: "dp-1", domain: "mybrand.com" }],
		]);

		await saveInlineLinksAction({
			input: {
				crawlId: "crawl-1",
				promptQueryId: "pq-1",
				domainProjectId: "dp-1",
				inlineLinks: [
					{
						title: "Acme",
						url: "https://acme.com/page",
						domain: "acme.com",
						position: 1,
					},
				],
				sourcePanelLinks: [],
			},
			ctx: makeCtx(db),
		});

		const capturedValues = db.__getCapturedValues();
		const row = capturedValues[0]?.[0] as Record<string, unknown>;
		expect(row.isCompetitorDomain).toBe("true");
	});

	it("returns 0 linksSaved when empty array provided", async () => {
		db.__setupSelect([
			[{ id: "crawl-1", promptQueryId: "pq-1" }],
			[{ id: "pq-1", domainProjectId: "dp-1" }],
			[],
			[{ id: "dp-1", domain: "mybrand.com" }],
		]);

		const result = await saveInlineLinksAction({
			input: {
				crawlId: "crawl-1",
				promptQueryId: "pq-1",
				domainProjectId: "dp-1",
				inlineLinks: [],
				sourcePanelLinks: [],
			},
			ctx: makeCtx(db),
		});

		expect(result.linksSaved).toBe(0);
		expect(db.insert).not.toHaveBeenCalled();
	});

	it("throws when crawl record not found", async () => {
		db.__setupSelect([[]]);

		await expect(
			saveInlineLinksAction({
				input: {
					crawlId: "nonexistent",
					promptQueryId: "pq-1",
					domainProjectId: "dp-1",
					inlineLinks: [
						{
							title: "Link",
							url: "https://example.com",
							domain: "example.com",
							position: 1,
						},
					],
					sourcePanelLinks: [],
				},
				ctx: makeCtx(db),
			}),
		).rejects.toThrow("Crawl record not found");
	});
});
