import { createHmac, randomInt } from "node:crypto";

export const VERIFICATION_CODE_TTL_MS = 10 * 60 * 1000;
export const MAX_VERIFICATION_ATTEMPTS = 5;

export function generateVerificationCode(): string {
	return String(randomInt(100_000, 1_000_000));
}

export function hashVerificationCode(code: string, secret: string): string {
	return createHmac("sha256", secret).update(code).digest("hex");
}

export function verificationCodeExpiresAt(now: Date): Date {
	return new Date(now.getTime() + VERIFICATION_CODE_TTL_MS);
}
