import { describe, expect, it } from "bun:test";
import { assertResendSent } from "../src/scan/reportEmails";
import { ScanReportError } from "../src/scan/scanErrors";

describe("assertResendSent", () => {
	it("throws a clear error when Resend blocks non-account recipients on the test sender", () => {
		expect(() =>
			assertResendSent({
				data: null,
				error: {
					message:
						"You can only send testing emails to your own email address (opencited@gmail.com). To send emails to other recipients, please verify a domain at resend.com/domains, and change the `from` address to an email using this domain.",
					name: "validation_error",
					statusCode: 403,
				},
				headers: null,
			}),
		).toThrow(ScanReportError);

		try {
			assertResendSent({
				data: null,
				error: {
					message:
						"You can only send testing emails to your own email address (opencited@gmail.com).",
					name: "validation_error",
					statusCode: 403,
				},
				headers: null,
			});
		} catch (error) {
			expect((error as Error).message).toContain("Resend’s test sender");
		}
	});

	it("passes when Resend returns a message id", () => {
		expect(() =>
			assertResendSent({
				data: { id: "msg_123" },
				error: null,
				headers: null,
			}),
		).not.toThrow();
	});
});
