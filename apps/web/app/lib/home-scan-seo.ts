import type { Metadata } from "next";

export const HOME_SCAN_CANONICAL_URL = "https://www.opencited.com/";

export const homeScanMetadata: Metadata = {
	title: "AI visibility checker and AEO checker — OpenCited",
	description:
		"Free AI visibility checker and AEO checker: technical checklist score, top issues, and answer-engine visibility after you verify a work email on your domain.",
	alternates: {
		canonical: HOME_SCAN_CANONICAL_URL,
	},
};

export const HOME_SCAN_FAQ = [
	{
		question: "What is AEO?",
		answer:
			"Answer Engine Optimization (AEO) is the work of getting AI answer engines to mention and cite your site when people ask questions in tools like Perplexity.",
	},
	{
		question: "Does the free scan measure citations?",
		answer:
			"No. The instant result is a technical readiness checklist only—it does not query answer engines or show whether you were cited. You get a score out of 100, a readiness level, and top issues to fix on your site.",
	},
	{
		question: "What does the technical checklist include?",
		answer:
			"We crawl your domain and score signals answer engines rely on: structured data (JSON-LD), an llms.txt file if you publish one, robots and meta tags, and other on-page basics. JSON-LD is machine-readable schema markup search and AI systems parse; llms.txt is a plain-text file some AI crawlers read for crawling permission hints.",
	},
	{
		question: "Why verify a work email on the domain I scanned?",
		answer:
			"It confirms you represent the site before we run three live Perplexity queries and email the full report. We send a one-time code to that address, use it only to deliver your report, and do not add you to marketing lists. If you cannot receive mail on the domain (for example only personal Gmail for a company site), use an inbox you control on the same domain or a team alias your IT manages.",
	},
	{
		question: "Is it free?",
		answer:
			"Yes—no account or payment for the checker or the emailed report. OpenCited is MIT-licensed; use the View source on GitHub link in the page footer to audit or self-host the scanner.",
	},
] as const;
