import { describe, expect, it } from "bun:test";
import { recordCrawlDispatchAction } from "../src/promptQueryCrawl/updateCrawlAction";

type CrawlRow = {
	id: string;
	status: string;
	triggerRunId: string | null;
	startedAt: Date | null;
	error: string | null;
};

function collectParams(node: unknown, acc: unknown[] = []): unknown[] {
	if (!node || typeof node !== "object") return acc;
	if (Array.isArray(node)) {
		for (const item of node) collectParams(item, acc);
		return acc;
	}
	const record = node as {
		value?: unknown;
		encoder?: unknown;
		queryChunks?: unknown[];
	};
	if ("value" in record && "encoder" in record) {
		acc.push(record.value);
	}
	if (Array.isArray(record.queryChunks)) {
		for (const chunk of record.queryChunks) collectParams(chunk, acc);
	}
	return acc;
}

function createDb(row: CrawlRow) {
	const updates: Array<Record<string, unknown>> = [];

	const db = {
		update() {
			return {
				set(values: Record<string, unknown>) {
					return {
						where(condition: unknown) {
							return {
								returning: async () => {
									const params = collectParams(condition);
									const requiresPending = params.includes("pending");
									const matchesId = params.includes(row.id);
									if (!matchesId) return [];
									if (requiresPending && row.status !== "pending") return [];
									if (typeof values.status === "string") {
										row.status = values.status;
									}
									if ("triggerRunId" in values) {
										row.triggerRunId = values.triggerRunId as string;
									}
									if ("startedAt" in values) {
										row.startedAt = values.startedAt as Date;
									}
									updates.push(values);
									return [{ ...row }];
								},
							};
						},
					};
				},
			};
		},
	};

	return { db, updates, row };
}

const ctxBase = {
	userId: null,
	isAuthenticated: false,
};

describe("recordCrawlDispatchAction", () => {
	it("does not flip a failed crawl back to running", async () => {
		const { db, updates, row } = createDb({
			id: "crawl-1",
			status: "failed",
			triggerRunId: null,
			startedAt: null,
			error: "Skipped: Perplexity is disabled.",
		});
		const startedAt = new Date("2026-11-02T04:00:00Z");

		const result = await recordCrawlDispatchAction({
			input: {
				id: "crawl-1",
				triggerRunId: "job-1",
				startedAt,
			},
			ctx: { ...ctxBase, db },
		});

		expect(result.status).toBe("failed");
		expect(result.triggerRunId).toBe("job-1");
		expect(result.startedAt).toBeNull();
		expect(row.status).toBe("failed");
		expect(updates).toEqual([{ triggerRunId: "job-1" }]);
	});

	it("promotes a pending crawl to running and stores the job id", async () => {
		const { db, row } = createDb({
			id: "crawl-1",
			status: "pending",
			triggerRunId: null,
			startedAt: null,
			error: null,
		});
		const startedAt = new Date("2026-11-02T04:00:00Z");

		const result = await recordCrawlDispatchAction({
			input: {
				id: "crawl-1",
				triggerRunId: "job-1",
				startedAt,
			},
			ctx: { ...ctxBase, db },
		});

		expect(result.status).toBe("running");
		expect(result.triggerRunId).toBe("job-1");
		expect(result.startedAt).toEqual(startedAt);
		expect(row.status).toBe("running");
	});
});
