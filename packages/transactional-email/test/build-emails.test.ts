import { describe, expect, it } from "bun:test";
import {
	buildFullReportEmail,
	buildVerificationCodeEmail,
} from "../src/build-emails";

describe("scan email builders", () => {
	it("escapes HTML in user-controlled fields", async () => {
		const malicious = '<script>alert("x")</script>';
		const email = await buildFullReportEmail({
			domain: malicious,
			score: 50,
			readiness: "needs-work",
			issues: [
				{
					check: "test",
					issue: malicious,
					howToFix: malicious,
				},
			],
		});
		expect(email.html).not.toContain("<script>");
		expect(email.html).toContain("&lt;script&gt;");
	});

	it("includes score, readiness badge, and structured issues in HTML", async () => {
		const email = await buildFullReportEmail({
			domain: "convoform.com",
			score: 75,
			readiness: "ready",
			issues: [
				{
					check: "json-ld",
					issue: "No valid JSON-LD found",
					howToFix: "Add Organization schema.",
				},
			],
		});

		expect(email.subject).toContain("convoform.com");
		expect(email.html).toContain("75");
		expect(email.html).toContain("Ready");
		expect(email.html).toContain("json-ld");
		expect(email.html).toContain("How to fix:");
		expect(email.text).toContain("[json-ld]");
	});

	it("renders a prominent verification code block", async () => {
		const email = await buildVerificationCodeEmail({
			domain: "example.com",
			code: "123456",
		});

		expect(email.html).toContain("123456");
		expect(email.html).toContain("Verify your email");
		expect(email.text).toContain("123456");
	});
});
