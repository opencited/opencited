import { beforeEach, describe, expect, it, mock } from "bun:test";

mock.module("@opentelemetry/api", () => ({
	trace: {
		getTracer: () => ({
			startSpan: (_name: string, _opts: unknown, fn: unknown) => {
				if (typeof fn === "function") return fn({}, { active: () => ({}) });
				return {};
			},
		}),
	},
	context: {
		active: () => ({}),
		with: (_ctx: unknown, fn: (...args: unknown[]) => unknown) => fn(),
	},
	propagation: { getBaggage: () => undefined },
	metrics: { getMeter: () => ({}) },
	diag: { setLogger: () => {}, createDiagLogger: () => ({}) },
	SpanStatusCode: { OK: 0, ERROR: 1, UNSET: 2 },
	SpanKind: { INTERNAL: 0, SERVER: 1, CLIENT: 2, PRODUCER: 3, CONSUMER: 4 },
	ValueType: { INT: 0, DOUBLE: 1 },
}));

import { saveBrandIntelligenceAction } from "../src/ai/saveBrandIntelligenceAction";

interface CallRecord {
	type: "select" | "insert" | "update";
	table: unknown;
	values?: unknown;
	set?: unknown;
}

function makeMockDb() {
	const calls: CallRecord[] = [];
	let nextId = 1;

	const db = {
		select: () => ({
			from: () => ({
				where: () => Promise.resolve([]),
			}),
		}),
		insert: (table: unknown) => {
			calls.push({ type: "insert", table });
			return {
				values: (values: unknown) => {
					const last = calls[calls.length - 1];
					if (last) last.values = values;
					const arr = Array.isArray(values) ? values : [values];
					const returned = arr.map((v: { name?: string; domain?: string }) => ({
						...v,
						id: `mock-${nextId++}`,
					}));
					return {
						returning: () => Promise.resolve(returned),
					};
				},
			};
		},
		update: (table: unknown) => {
			calls.push({ type: "update", table });
			return {
				set: (data: unknown) => {
					const last = calls[calls.length - 1];
					if (last) last.set = data;
					return {
						where: () => Promise.resolve(),
					};
				},
			};
		},
	};

	return { db, calls };
}

const baseCtx = {
	userId: null,
	isAuthenticated: false,
};

describe("saveBrandIntelligenceAction — position field", () => {
	let mockDb: ReturnType<typeof makeMockDb>;

	beforeEach(() => {
		mockDb = makeMockDb();
	});

	it("persists the position from each brand mention to the insert call", async () => {
		await saveBrandIntelligenceAction({
			input: {
				crawlId: "crawl-1",
				domainProjectId: "dp-1",
				intelligence: {
					brandMentions: [
						{
							brandName: "MyBrand",
							brandUrl: "https://mybrand.com",
							context: "First mention.",
							mentionType: "target",
							position: 1,
						},
						{
							brandName: "Acme",
							brandUrl: "https://acme.com",
							context: "Second mention.",
							mentionType: "competitor",
							position: 2,
						},
						{
							brandName: "Beta",
							brandUrl: "https://beta.com",
							context: "Third mention.",
							mentionType: "competitor",
							position: 3,
						},
					],
					discoveredCompetitors: [
						{ name: "Acme", domain: "acme.com" },
						{ name: "Beta", domain: "beta.com" },
					],
					answerFormat: "numbered_list",
				},
			},
			ctx: { ...baseCtx, db: mockDb.db },
		});

		const brandMentionInsert = [...mockDb.calls]
			.reverse()
			.find(
				(c) =>
					c.type === "insert" &&
					Array.isArray(c.values) &&
					(c.values as unknown[]).length === 3,
			);
		expect(brandMentionInsert).toBeDefined();
		const values = brandMentionInsert?.values as Array<{
			position: number;
			brandName: string;
		}>;
		expect(values[0]?.position).toBe(1);
		expect(values[1]?.position).toBe(2);
		expect(values[2]?.position).toBe(3);
	});

	it("preserves the source-order position values exactly", async () => {
		await saveBrandIntelligenceAction({
			input: {
				crawlId: "crawl-2",
				domainProjectId: "dp-1",
				intelligence: {
					brandMentions: [
						{
							brandName: "BrandA",
							brandUrl: "https://branda.com",
							context: "First.",
							mentionType: "competitor",
							position: 1,
						},
						{
							brandName: "BrandB",
							brandUrl: "https://brandb.com",
							context: "Second.",
							mentionType: "competitor",
							position: 2,
						},
						{
							brandName: "BrandC",
							brandUrl: "https://brandc.com",
							context: "Third.",
							mentionType: "competitor",
							position: 3,
						},
						{
							brandName: "BrandD",
							brandUrl: "https://brandd.com",
							context: "Fourth.",
							mentionType: "competitor",
							position: 4,
						},
					],
					discoveredCompetitors: [],
					answerFormat: "paragraph",
				},
			},
			ctx: { ...baseCtx, db: mockDb.db },
		});

		const insertCall = mockDb.calls.find((c) => c.type === "insert");
		const values = insertCall?.values as Array<{ position: number }>;
		expect(values.map((v) => v.position)).toEqual([1, 2, 3, 4]);
	});

	it("handles a crawl where the target brand is not mentioned (no target row, but positions still present)", async () => {
		await saveBrandIntelligenceAction({
			input: {
				crawlId: "crawl-3",
				domainProjectId: "dp-1",
				intelligence: {
					brandMentions: [
						{
							brandName: "Acme",
							brandUrl: "https://acme.com",
							context: "Acme leads the list.",
							mentionType: "competitor",
							position: 1,
						},
						{
							brandName: "Beta",
							brandUrl: "https://beta.com",
							context: "Beta comes second.",
							mentionType: "competitor",
							position: 2,
						},
					],
					discoveredCompetitors: [],
					answerFormat: "numbered_list",
				},
			},
			ctx: { ...baseCtx, db: mockDb.db },
		});

		const insertCall = mockDb.calls.find((c) => c.type === "insert");
		const values = insertCall?.values as Array<{
			mentionType: string;
			position: number;
		}>;
		expect(values).toHaveLength(2);
		expect(values.every((v) => v.mentionType === "competitor")).toBe(true);
		expect(values[0]?.position).toBe(1);
		expect(values[1]?.position).toBe(2);
	});

	it("returns the count of mentions saved", async () => {
		const result = await saveBrandIntelligenceAction({
			input: {
				crawlId: "crawl-4",
				domainProjectId: "dp-1",
				intelligence: {
					brandMentions: [
						{
							brandName: "A",
							brandUrl: "https://a.com",
							context: "x",
							mentionType: "other",
							position: 1,
						},
						{
							brandName: "B",
							brandUrl: "https://b.com",
							context: "x",
							mentionType: "other",
							position: 2,
						},
					],
					discoveredCompetitors: [],
					answerFormat: "unknown",
				},
			},
			ctx: { ...baseCtx, db: mockDb.db },
		});
		expect(result.mentionsSaved).toBe(2);
	});
});
