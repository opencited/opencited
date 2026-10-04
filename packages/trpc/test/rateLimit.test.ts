import { describe, expect, it } from "bun:test";
import type { TRPCError } from "@trpc/server";
import { appRouter } from "../src/router/root";

function makeCaller(ip?: string) {
	return appRouter.createCaller({
		userId: null,
		isAuthenticated: false,
		db: null as never,
		ip,
	});
}

async function captureError(
	promise: Promise<unknown>,
): Promise<TRPCError | undefined> {
	try {
		await promise;
		return undefined;
	} catch (err) {
		return err as TRPCError;
	}
}

describe("scan rate limit", () => {
	it("skips rate limiting when no ip is present", async () => {
		const caller = makeCaller();

		for (let i = 0; i < 12; i++) {
			const error = await captureError(caller.scan.run({ domain: "" }));
			expect(error?.code).toBe("BAD_REQUEST");
		}
	});

	it("rejects requests over the per-ip budget with TOO_MANY_REQUESTS", async () => {
		const caller = makeCaller("203.0.113.7");

		for (let i = 0; i < 10; i++) {
			const error = await captureError(caller.scan.run({ domain: "" }));
			expect(error?.code).toBe("BAD_REQUEST");
		}

		const blocked = await captureError(caller.scan.run({ domain: "" }));
		expect(blocked?.code).toBe("TOO_MANY_REQUESTS");
		expect(blocked?.message).toContain("Too many scans");
	});

	it("does not leak budget across different ips", async () => {
		const first = makeCaller("198.51.100.4");
		const second = makeCaller("198.51.100.5");

		for (let i = 0; i < 10; i++) {
			const error = await captureError(first.scan.run({ domain: "" }));
			expect(error?.code).toBe("BAD_REQUEST");
		}
		const blockedFirst = await captureError(first.scan.run({ domain: "" }));
		expect(blockedFirst?.code).toBe("TOO_MANY_REQUESTS");

		const errorSecond = await captureError(second.scan.run({ domain: "" }));
		expect(errorSecond?.code).toBe("BAD_REQUEST");
	});
});
