import { describe, expect, it, mock } from "bun:test";
import type { Db } from "@opencited/db";
import { withDb } from "../src/db";

describe("withDb", () => {
	it("ends its pool after the callback resolves", async () => {
		const end = mock(async () => {});
		const db = { id: "scoped-db" } as unknown as Db;

		const result = await withDb(
			async (scopedDb) => {
				expect(scopedDb).toBe(db);
				return "done";
			},
			() => ({ db, pool: { end } as never }),
		);

		expect(result).toBe("done");
		expect(end).toHaveBeenCalledTimes(1);
	});

	it("ends its pool when the callback throws", async () => {
		const end = mock(async () => {});

		await expect(
			withDb(
				async () => {
					throw new Error("crawl failed");
				},
				() => ({ db: {} as Db, pool: { end } as never }),
			),
		).rejects.toThrow("crawl failed");

		expect(end).toHaveBeenCalledTimes(1);
	});

	it("does not let a failing pool close mask the callback error", async () => {
		await expect(
			withDb(
				async () => {
					throw new Error("crawl failed");
				},
				() => ({
					db: {} as Db,
					pool: {
						end: mock(async () => {
							throw new Error("pool already closed");
						}),
					} as never,
				}),
			),
		).rejects.toThrow("crawl failed");
	});
});
