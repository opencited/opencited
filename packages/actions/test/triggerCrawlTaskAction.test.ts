import { describe, expect, it } from "bun:test";
import {
	answerEngineTable,
	promptQueryCrawlTable,
	promptQueryTable,
} from "@opencited/db";
import { EngineDisabledError } from "../src/answerEngine";
import { batchTriggerCrawlTaskAction } from "../src/promptQueryCrawl/batchTriggerCrawlAction";
import { triggerCrawlTaskAction } from "../src/promptQueryCrawl/triggerCrawlAction";

type CrawlRow = {
	id: string;
	promptQueryId: string;
	provider: string;
	status: string;
	createdAt: Date;
};

type PromptRow = {
	id: string;
	query: string;
	domainProjectId: string;
};

type EngineRow = {
	key: string;
	displayName: string;
	status: string;
	disabledReason: string | null;
	sortOrder: number;
};

const engines: EngineRow[] = [
	{
		key: "chatgpt",
		displayName: "ChatGPT",
		status: "enabled",
		disabledReason: null,
		sortOrder: 10,
	},
	{
		key: "perplexity",
		displayName: "Perplexity",
		status: "disabled",
		disabledReason: "Perplexity is paused.",
		sortOrder: 20,
	},
];

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

function flatParams(params: unknown[]): unknown[] {
	return params.flatMap((param) => (Array.isArray(param) ? param : [param]));
}

function createDb(options: {
	engineRows?: EngineRow[];
	crawls?: CrawlRow[];
	prompts?: PromptRow[];
}) {
	const inserts: unknown[] = [];
	const engineRows = options.engineRows ?? engines;
	const crawls = options.crawls ?? [];
	const prompts = options.prompts ?? [];

	function chain(rows: unknown[]) {
		let current = rows;
		const query = {
			where(condition: unknown) {
				const params = flatParams(collectParams(condition));
				current = current.filter((row) => {
					const record = row as {
						provider?: string;
						promptQueryId?: string;
						id?: string;
					};
					const providers = params.filter(
						(param): param is string =>
							param === "chatgpt" || param === "perplexity",
					);
					const ids = params.filter(
						(param): param is string =>
							typeof param === "string" &&
							(param.startsWith("pq-") || param.startsWith("prompt-")),
					);
					if (
						providers.length > 0 &&
						record.provider &&
						!providers.includes(record.provider)
					) {
						return false;
					}
					if (ids.length > 0) {
						const id = record.promptQueryId ?? record.id;
						if (id && !ids.includes(id)) return false;
					}
					return true;
				});
				return query;
			},
			orderBy() {
				current = [...current].sort((a, b) => {
					const left = a as { createdAt?: Date; sortOrder?: number };
					const right = b as { createdAt?: Date; sortOrder?: number };
					if (left.createdAt && right.createdAt) {
						return right.createdAt.getTime() - left.createdAt.getTime();
					}
					return (left.sortOrder ?? 0) - (right.sortOrder ?? 0);
				});
				return query;
			},
			limit(count: number) {
				return Promise.resolve(current.slice(0, count));
			},
			// biome-ignore lint/suspicious/noThenProperty: the action awaits the query builder
			then(
				resolve: (value: unknown[]) => unknown,
				reject?: (reason: unknown) => unknown,
			) {
				return Promise.resolve(current).then(resolve, reject);
			},
		};
		return query;
	}

	const db = {
		select() {
			return {
				from(table: unknown) {
					if (table === answerEngineTable) return chain(engineRows);
					if (table === promptQueryCrawlTable) return chain(crawls);
					if (table === promptQueryTable) return chain(prompts);
					throw new Error("unexpected table");
				},
			};
		},
		insert() {
			return {
				values(values: unknown) {
					const list = Array.isArray(values) ? values : [values];
					inserts.push(...list);
					return {
						returning: async () =>
							list.map((value, index) => ({
								id: `crawl-new-${inserts.length - list.length + index}`,
								...(value as object),
							})),
					};
				},
			};
		},
	};

	return { db, inserts };
}

const ctxBase = {
	userId: "user-1",
	isAuthenticated: true,
};

describe("triggerCrawlTaskAction", () => {
	it("throws EngineDisabledError and inserts no row for a disabled engine", async () => {
		const { db, inserts } = createDb({
			prompts: [
				{ id: "pq-1", query: "What is a CRM?", domainProjectId: "dp-1" },
			],
		});

		await expect(
			triggerCrawlTaskAction({
				input: { promptQueryId: "pq-1", provider: "perplexity" },
				ctx: { ...ctxBase, db },
			}),
		).rejects.toBeInstanceOf(EngineDisabledError);
		expect(inserts).toHaveLength(0);
	});

	it("does not let a pending Perplexity crawl block ChatGPT", async () => {
		const { db, inserts } = createDb({
			crawls: [
				{
					id: "crawl-old",
					promptQueryId: "pq-1",
					provider: "perplexity",
					status: "pending",
					createdAt: new Date("2026-11-01T00:00:00Z"),
				},
			],
			prompts: [
				{ id: "pq-1", query: "What is a CRM?", domainProjectId: "dp-1" },
			],
		});

		const result = await triggerCrawlTaskAction({
			input: { promptQueryId: "pq-1", provider: "chatgpt" },
			ctx: { ...ctxBase, db },
		});

		expect(result.provider).toBe("chatgpt");
		expect(inserts).toHaveLength(1);
	});

	it("allows a run when an older crawl for that provider is pending and the latest one finished", async () => {
		const { db, inserts } = createDb({
			engineRows: [
				{
					key: "chatgpt",
					displayName: "ChatGPT",
					status: "enabled",
					disabledReason: null,
					sortOrder: 10,
				},
				{
					key: "perplexity",
					displayName: "Perplexity",
					status: "enabled",
					disabledReason: null,
					sortOrder: 20,
				},
			],
			crawls: [
				{
					id: "crawl-old",
					promptQueryId: "pq-1",
					provider: "chatgpt",
					status: "pending",
					createdAt: new Date("2026-11-01T00:00:00Z"),
				},
				{
					id: "crawl-new",
					promptQueryId: "pq-1",
					provider: "chatgpt",
					status: "completed",
					createdAt: new Date("2026-11-02T00:00:00Z"),
				},
			],
			prompts: [
				{ id: "pq-1", query: "What is a CRM?", domainProjectId: "dp-1" },
			],
		});

		await triggerCrawlTaskAction({
			input: { promptQueryId: "pq-1", provider: "chatgpt" },
			ctx: { ...ctxBase, db },
		});
		expect(inserts).toHaveLength(1);
	});

	it("blocks a new run when the latest crawl for that provider is pending", async () => {
		const { db, inserts } = createDb({
			crawls: [
				{
					id: "crawl-new",
					promptQueryId: "pq-1",
					provider: "chatgpt",
					status: "pending",
					createdAt: new Date("2026-11-02T00:00:00Z"),
				},
			],
			prompts: [
				{ id: "pq-1", query: "What is a CRM?", domainProjectId: "dp-1" },
			],
		});

		await expect(
			triggerCrawlTaskAction({
				input: { promptQueryId: "pq-1", provider: "chatgpt" },
				ctx: { ...ctxBase, db },
			}),
		).rejects.toThrow("A crawl is already running for this prompt");
		expect(inserts).toHaveLength(0);
	});
});

describe("batchTriggerCrawlTaskAction", () => {
	it("throws EngineDisabledError and inserts no rows for a disabled engine", async () => {
		const { db, inserts } = createDb({
			prompts: [
				{ id: "pq-1", query: "One", domainProjectId: "dp-1" },
				{ id: "pq-2", query: "Two", domainProjectId: "dp-1" },
			],
		});

		await expect(
			batchTriggerCrawlTaskAction({
				input: { promptQueryIds: ["pq-1", "pq-2"], provider: "perplexity" },
				ctx: { ...ctxBase, db },
			}),
		).rejects.toBeInstanceOf(EngineDisabledError);
		expect(inserts).toHaveLength(0);
	});

	it("does not treat a pending crawl on another engine as active", async () => {
		const { db, inserts } = createDb({
			crawls: [
				{
					id: "crawl-p",
					promptQueryId: "pq-1",
					provider: "perplexity",
					status: "running",
					createdAt: new Date("2026-11-02T00:00:00Z"),
				},
			],
			prompts: [
				{ id: "pq-1", query: "One", domainProjectId: "dp-1" },
				{ id: "pq-2", query: "Two", domainProjectId: "dp-1" },
			],
		});

		const result = await batchTriggerCrawlTaskAction({
			input: { promptQueryIds: ["pq-1", "pq-2"], provider: "chatgpt" },
			ctx: { ...ctxBase, db },
		});

		expect(result.count).toBe(2);
		expect(inserts).toHaveLength(2);
	});
});
