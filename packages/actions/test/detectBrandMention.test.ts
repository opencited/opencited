import { describe, expect, it } from "bun:test";
import { detectBrandMention } from "../src/scan/aiMentionProbe/detectBrandMention";

describe("detectBrandMention", () => {
	it("marks visible when the brand appears in the answer", () => {
		const result = detectBrandMention({
			domain: "acme.com",
			brandName: "Acme",
			answer: "Many teams rely on Acme for issue tracking.",
			citationUrls: [],
		});
		expect(result.visibility).toBe("visible");
		expect(result.excerpt).toContain("Acme");
	});

	it("marks visible when a citation matches the scanned domain", () => {
		const result = detectBrandMention({
			domain: "acme.com",
			brandName: "Other",
			answer: "Here are popular tools.",
			citationUrls: ["https://www.acme.com/pricing"],
		});
		expect(result.visibility).toBe("visible");
	});

	it("marks not visible when brand and citations are absent", () => {
		const result = detectBrandMention({
			domain: "acme.com",
			brandName: "Acme",
			answer: "Linear and Jira are common choices.",
			citationUrls: ["https://linear.app"],
		});
		expect(result.visibility).toBe("not-visible");
	});
});
