import { describe, expect, it } from "bun:test";
import {
	citationUrlsFromCrawl,
	probeRowFromCrawl,
} from "../src/scan/aiMentionProbe/probeRowFromCrawl";

describe("citationUrlsFromCrawl", () => {
	it("merges inline and source panel links", () => {
		const urls = citationUrlsFromCrawl({
			inlineLinks: [{ url: "https://a.com" }],
			sourcePanelLinks: [{ url: "https://b.com" }],
		});
		expect(urls).toEqual(["https://a.com", "https://b.com"]);
	});
});

describe("probeRowFromCrawl", () => {
	it("marks visible when a citation matches the scan domain", () => {
		const row = probeRowFromCrawl({
			domain: "acme.com",
			brandName: "Acme",
			query: "best widgets",
			answer: "Here are top tools.",
			citationUrls: ["https://www.acme.com/pricing"],
		});
		expect(row.visibility).toBe("visible");
		expect(row.query).toBe("best widgets");
	});

	it("marks not visible when brand and domain are absent", () => {
		const row = probeRowFromCrawl({
			domain: "acme.com",
			brandName: "Acme",
			query: "best widgets",
			answer: "Try OtherCo for widgets.",
			citationUrls: ["https://other.co"],
		});
		expect(row.visibility).toBe("not-visible");
	});
});
