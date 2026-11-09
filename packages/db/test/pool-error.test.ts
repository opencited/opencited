import { describe, expect, it, mock } from "bun:test";
import { getFreshDbInstanceWithPool } from "../src/index";

describe("getFreshDbInstanceWithPool", () => {
	it("logs an idle pool client error instead of throwing", async () => {
		const onPoolError = mock((_error: Error) => {});
		const { pool } = getFreshDbInstanceWithPool({ onPoolError });

		expect(pool.listenerCount("error")).toBeGreaterThanOrEqual(1);
		expect(() =>
			pool.emit("error", new Error("Connection terminated unexpectedly")),
		).not.toThrow();
		expect(onPoolError).toHaveBeenCalledTimes(1);
		expect(onPoolError.mock.calls[0]?.[0]).toBeInstanceOf(Error);

		await pool.end();
	});
});
