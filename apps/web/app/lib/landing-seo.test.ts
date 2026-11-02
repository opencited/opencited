import { describe, expect, it } from "bun:test";
import {
	LANDING_CANONICAL_URL,
	LANDING_DESCRIPTION,
	LANDING_FAQ,
	LANDING_OG_IMAGE,
	LANDING_TITLE,
	landingMetadata,
} from "./landing-seo";

describe("landingMetadata", () => {
	it("uses the product positioning in the title and description", () => {
		expect(String(landingMetadata.title)).toContain(
			"See what AI tells your buyers about you",
		);
		expect(LANDING_TITLE.toLowerCase()).toContain("openCited".toLowerCase());
		expect(LANDING_DESCRIPTION).toContain("ChatGPT");
		expect(LANDING_DESCRIPTION).toContain("Perplexity");
	});

	it("sets the production canonical URL", () => {
		expect(landingMetadata.alternates?.canonical).toBe(LANDING_CANONICAL_URL);
	});

	it("references the static OG image with alt text", () => {
		expect(LANDING_OG_IMAGE.url).toBe("/opengraph-image.png");
		expect(LANDING_OG_IMAGE.alt).toContain("ChatGPT and Perplexity");
	});

	it("does not name a license", () => {
		expect(`${LANDING_TITLE} ${LANDING_DESCRIPTION}`).not.toMatch(/\bmit\b/i);
	});
});

describe("LANDING_FAQ", () => {
	const everyAnswer = LANDING_FAQ.map((item) => item.answer).join(" ");

	it("covers the seven launch questions", () => {
		const questions = LANDING_FAQ.map((item) => item.question);
		expect(questions).toHaveLength(7);
		expect(questions[0]).toBe("Which AI engines does OpenCited check?");
		expect(questions).toContain("How much does it cost?");
		expect(questions).toContain("Can I self-host OpenCited?");
	});

	it("names the two live engines and no others as live", () => {
		const engines = LANDING_FAQ.find((item) =>
			item.question.includes("engines"),
		);
		expect(engines?.answer).toContain("ChatGPT and Perplexity");
	});

	it("does not promise scheduled or weekly runs", () => {
		expect(everyAnswer.toLowerCase()).not.toContain("every week");
		expect(everyAnswer.toLowerCase()).not.toContain("automatically");
		expect(everyAnswer.toLowerCase()).not.toContain("scheduled");
		expect(everyAnswer).toContain("Runs are manual");
	});

	it("describes self-hosting from the README", () => {
		const selfHost = LANDING_FAQ.find((item) =>
			item.question.includes("self-host"),
		);
		expect(selfHost?.answer).toContain("README");
		expect(selfHost?.answer).toContain("Docker");
		expect(selfHost?.answer).toContain("Postgres");
		expect(selfHost?.answer).toContain("Redis");
		expect(selfHost?.answer).toContain("Clerk");
	});

	it("keeps pricing to free during beta", () => {
		const pricing = LANDING_FAQ.find((item) => item.question.includes("cost"));
		expect(pricing?.answer).toBe("OpenCited is free during beta.");
	});

	it("does not claim a license or an absolute privacy guarantee", () => {
		expect(everyAnswer).not.toMatch(/\bmit\b/i);
		expect(everyAnswer.toLowerCase()).not.toContain("license");
		expect(everyAnswer.toLowerCase()).not.toContain("100% private");
		expect(everyAnswer.toLowerCase()).not.toContain("fully private");
		expect(everyAnswer.toLowerCase()).not.toContain("never sell");
		expect(everyAnswer.toLowerCase()).not.toContain("never share");
	});
});
