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
			probe: { status: "unavailable" },
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
			probe: { status: "unavailable" },
		});

		expect(email.subject).toContain("convoform.com");
		expect(email.html).toContain("75");
		expect(email.html).toContain("Ready");
		expect(email.html).toContain("json-ld");
		expect(email.html).toContain("How to fix:");
		expect(email.text).toContain("[json-ld]");
	});

	it("uses a distinct subject for visibility follow-up emails", async () => {
		const email = await buildFullReportEmail({
			domain: "oration.ai",
			score: 90,
			readiness: "ready",
			issues: [],
			probe: {
				status: "ok",
				queries: [
					{
						query: "voice AI tools",
						visibility: "visible",
						excerpt: "Oration is a voice AI platform.",
						citationUrls: ["https://oration.ai"],
					},
				],
			},
			visibilityUpdate: true,
		});
		expect(email.subject).toBe("AI visibility results for oration.ai");
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
