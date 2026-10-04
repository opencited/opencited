import { describe, expect, it } from "bun:test";
import {
	HOME_SCAN_CANONICAL_URL,
	HOME_SCAN_FAQ,
	homeScanMetadata,
} from "./home-scan-seo";

describe("homeScanMetadata", () => {
	it("includes both target phrases in title and description", () => {
		const title = String(homeScanMetadata.title);
		const description = String(homeScanMetadata.description);
		expect(title.toLowerCase()).toContain("ai visibility checker");
		expect(title.toLowerCase()).toContain("aeo checker");
		expect(description.toLowerCase()).toContain("ai visibility checker");
		expect(description.toLowerCase()).toContain("aeo checker");
	});

	it("sets the production canonical URL", () => {
		expect(homeScanMetadata.alternates?.canonical).toBe(
			HOME_SCAN_CANONICAL_URL,
		);
	});
});

describe("HOME_SCAN_FAQ", () => {
	it("covers AEO, citations honesty, email gate, and free tier", () => {
		const questions = HOME_SCAN_FAQ.map((item) => item.question);
		expect(questions[0]).toBe("What is AEO?");
		expect(questions).toContain("Does the free scan measure citations?");
		expect(questions).toContain("Is it free?");
		expect(questions.some((q) => q.toLowerCase().includes("email"))).toBe(true);
	});

	it("states upfront that the free tier does not measure citations", () => {
		const citations = HOME_SCAN_FAQ.find((item) =>
			item.question.includes("citations"),
		);
		expect(citations?.answer.startsWith("No.")).toBe(true);
	});
});
