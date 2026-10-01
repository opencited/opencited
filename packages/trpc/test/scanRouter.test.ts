import { describe, expect, it } from "bun:test";
import type { TRPCError } from "@trpc/server";
import { appRouter } from "../src/router/root";

const caller = appRouter.createCaller({
	userId: null,
	isAuthenticated: false,
	db: null as never,
});

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

describe("scanRouter.run", () => {
	it("rejects an empty domain with a validation error", async () => {
		const error = await captureError(caller.scan.run({ domain: "" }));

		expect(error?.code).toBe("BAD_REQUEST");
		expect(error?.message).toContain("Enter a domain to scan.");
	});

	it("maps target errors to BAD_REQUEST with a friendly message", async () => {
		const error = await captureError(caller.scan.run({ domain: "localhost" }));

		expect(error?.code).toBe("BAD_REQUEST");
		expect(error?.message).toContain("not a public domain");
	});
});
