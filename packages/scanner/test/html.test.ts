import { describe, expect, it } from "bun:test";
import {
	extractHomepageSnapshot,
	extractHtmlCanonical,
	extractJsonLd,
	extractLinkHeaderCanonical,
} from "../src";

describe("extractJsonLd", () => {
	it("finds a valid JSON-LD block", () => {
		const html = `<html><head><script type="application/ld+json">{"@type":"Organization"}</script></head></html>`;
		const result = extractJsonLd(html);
		expect(result.valid).toBe(true);
		expect(result.types).toEqual(["Organization"]);
	});

	it("collects types from @graph and arrays", () => {
		const html = `<script type="application/ld+json">{"@graph":[{"@type":"WebSite"},{"@type":"BreadcrumbList"}]}</script>
<script type="application/ld+json">[{"@type":"FAQPage"},{"@type":"Organization"}]</script>`;
		const result = extractJsonLd(html);
		expect(result.valid).toBe(true);
		expect(result.types.sort()).toEqual([
			"BreadcrumbList",
			"FAQPage",
			"Organization",
			"WebSite",
		]);
	});

	it("collects array-valued @type", () => {
		const html = `<script type="application/ld+json">{"@type":["LocalBusiness","Organization"]}</script>`;
		const result = extractJsonLd(html);
		expect(result.types.sort()).toEqual(["LocalBusiness", "Organization"]);
	});

	it("ignores invalid JSON but accepts a valid sibling block", () => {
		const html = `<script type="application/ld+json">{not json</script>
<script type="application/ld+json">{"@type":"WebSite"}</script>`;
		const result = extractJsonLd(html);
		expect(result.valid).toBe(true);
		expect(result.types).toEqual(["WebSite"]);
	});

	it("returns invalid when all blocks are unparseable", () => {
		const html = `<script type="application/ld+json">{oops</script>`;
		expect(extractJsonLd(html).valid).toBe(false);
	});

	it("returns invalid when no JSON-LD block exists", () => {
		expect(extractJsonLd("<html><body>hi</body></html>").valid).toBe(false);
	});

	it("returns invalid for empty html", () => {
		expect(extractJsonLd("").valid).toBe(false);
	});
});

describe("extractHtmlCanonical", () => {
	it("extracts the canonical link href", () => {
		const html = `<html><head><link rel="canonical" href="https://example.com/" /></head></html>`;
		expect(extractHtmlCanonical(html)).toBe("https://example.com/");
	});

	it("returns null when absent", () => {
		expect(extractHtmlCanonical("<html></html>")).toBeNull();
		expect(extractHtmlCanonical("")).toBeNull();
	});
});

describe("extractHomepageSnapshot", () => {
	it("extracts title, description, h1, brand, and visible text", () => {
		const html = `<!DOCTYPE html><html><head>
<title>Acme Tools</title>
<meta name="description" content="We sell widgets." />
<meta property="og:site_name" content="Acme" />
<script type="application/ld+json">{"@type":"Organization","name":"Acme Inc"}</script>
</head><body><h1>Welcome</h1><p>Hello world</p><script>ignore()</script></body></html>`;
		const snapshot = extractHomepageSnapshot(html);
		expect(snapshot.title).toBe("Acme Tools");
		expect(snapshot.metaDescription).toBe("We sell widgets.");
		expect(snapshot.h1).toBe("Welcome");
		expect(snapshot.brandName).toBe("Acme Inc");
		expect(snapshot.textExcerpt).toContain("Hello world");
		expect(snapshot.textExcerpt).not.toContain("ignore");
	});

	it("returns empty snapshot for blank html", () => {
		expect(extractHomepageSnapshot("")).toEqual({
			title: null,
			metaDescription: null,
			h1: null,
			brandName: null,
			textExcerpt: "",
		});
	});
});

describe("extractLinkHeaderCanonical", () => {
	it("extracts canonical from a Link header", () => {
		expect(
			extractLinkHeaderCanonical('<https://example.com/>; rel="canonical"'),
		).toBe("https://example.com/");
	});

	it("extracts canonical among multiple link relations", () => {
		expect(
			extractLinkHeaderCanonical(
				'</llms.txt>; rel="llms-txt", <https://www.example.com/>; rel=canonical',
			),
		).toBe("https://www.example.com/");
	});

	it("returns null when no canonical relation is present", () => {
		expect(
			extractLinkHeaderCanonical('</llms.txt>; rel="llms-txt"'),
		).toBeNull();
		expect(extractLinkHeaderCanonical(null)).toBeNull();
	});
});
