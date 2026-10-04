import { describe, expect, it } from "bun:test";
import {
	generateVerificationCode,
	hashVerificationCode,
	verificationCodeExpiresAt,
	VERIFICATION_CODE_TTL_MS,
} from "../src/scan/verificationCode";

describe("verificationCode", () => {
	it("generates a 6-digit code and hashes it deterministically", () => {
		const code = generateVerificationCode();
		expect(code).toMatch(/^\d{6}$/);
		expect(hashVerificationCode(code, "secret")).toBe(
			hashVerificationCode(code, "secret"),
		);
	});

	it("expires codes 10 minutes after issue time", () => {
		const now = new Date("2026-10-02T12:00:00.000Z");
		const expiresAt = verificationCodeExpiresAt(now);
		expect(expiresAt.getTime() - now.getTime()).toBe(VERIFICATION_CODE_TTL_MS);
	});
});
