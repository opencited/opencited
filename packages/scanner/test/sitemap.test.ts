import { describe, expect, it } from "bun:test";
import {
	COMMON_SITEMAP_PATHS,
	commonSitemapUrls,
	looksLikeSitemap,
	selectSitemapCandidates,
} from "../src";

describe("looksLikeSitemap", () => {
	it("accepts XML sitemap documents", () => {
		expect(
			looksLikeSitemap(
				'<?xml version="1.0" encoding="UTF-8"?><urlset></urlset>',
			),
		).toBe(true);
		expect(looksLikeSitemap("<urlset><url></url></urlset>")).toBe(true);
		expect(looksLikeSitemap("<sitemapindex></sitemapindex>")).toBe(true);
		expect(looksLikeSitemap("\n  <urlset></urlset>")).toBe(true);
	});

	it("rejects HTML error pages and other content", () => {
		expect(looksLikeSitemap("<html><body>404</body></html>")).toBe(false);
		expect(looksLikeSitemap("")).toBe(false);
		expect(looksLikeSitemap("Not Found")).toBe(false);
	});
});

describe("selectSitemapCandidates", () => {
	it("resolves relative declarations against the robots.txt URL", () => {
		const candidates = selectSitemapCandidates(
			["custom-sitemap.xml", "https://cdn.example.com/s.xml"],
			"https://example.com/robots.txt",
		);
		expect(candidates).toEqual([
			"https://example.com/custom-sitemap.xml",
			"https://cdn.example.com/s.xml",
		]);
	});

	it("deduplicates candidates", () => {
		const candidates = selectSitemapCandidates(
			["/sitemap.xml", "https://example.com/sitemap.xml"],
			"https://example.com/robots.txt",
		);
		expect(candidates).toEqual(["https://example.com/sitemap.xml"]);
	});

	it("caps the number of declared sitemaps", () => {
		const declared = Array.from(
			{ length: 10 },
			(_, i) => `https://example.com/s${i}.xml`,
		);
		expect(
			selectSitemapCandidates(declared, "https://example.com/robots.txt"),
		).toHaveLength(6);
	});

	it("skips unparseable declarations", () => {
		const candidates = selectSitemapCandidates(
			["http://"],
			"https://example.com/robots.txt",
		);
		expect(candidates).toEqual([]);
	});
});

describe("commonSitemapUrls", () => {
	it("builds absolute URLs for every common path", () => {
		const urls = commonSitemapUrls("https://example.com");
		expect(urls).toHaveLength(COMMON_SITEMAP_PATHS.length);
		expect(urls[0]).toBe("https://example.com/sitemap.xml");
		expect(urls).toContain("https://example.com/wp-sitemap.xml");
	});
});
