import { describe, expect, it } from "bun:test";
import type { FetchLike, LookupFn, ScanTargetError } from "@opencited/scanner";
import {
	FREE_ISSUE_LIMIT,
	getReadinessLevel,
	runScanAction,
	runScanInputSchema,
	runScanOutputSchema,
} from "../src/scan";

const PUBLIC_IP = "93.184.216.34";

const publicLookup: LookupFn = async () => [PUBLIC_IP];

function makeHtml(body: string): Response {
	return new Response(body, {
		status: 200,
		headers: { "content-type": "text/html" },
	});
}

function makeText(body: string, status = 200): Response {
	return new Response(body, {
		status,
		headers: { "content-type": "text/plain" },
	});
}

function makeRedirect(location: string, status = 301): Response {
	return new Response(null, { status, headers: { location } });
}

type RouteHandler = () => Response | Promise<Response>;

function mockFetcher(routes: Record<string, RouteHandler>): FetchLike {
	return async (url) => {
		const handler = routes[url];
		if (!handler) return new Response("not found", { status: 404 });
		return handler();
	};
}

const JSON_LD_HOMEWORK = `<html><head>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Organization","name":"Example"}
</script>
</head><body>hi</body></html>`;

const PLAIN_HOMEWORK = `<html><head><title>Example</title></head><body>hi</body></html>`;

function cleanSiteRoutes(
	hostname = "example.com",
): Record<string, RouteHandler> {
	const origin = `https://${hostname}`;
	return {
		[`${origin}/`]: () => makeHtml(JSON_LD_HOMEWORK),
		[`http://${hostname}/`]: () => makeRedirect(`${origin}/`),
		[`${origin}/robots.txt`]: () =>
			makeText(`User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`),
		[`${origin}/llms.txt`]: () => makeText("# Example\n"),
		[`${origin}/sitemap.xml`]: () =>
			makeText(
				`<?xml version="1.0"?><urlset><url><loc>${origin}/a</loc></url></urlset>`,
			),
		[`${origin}/sitemap_index.xml`]: () =>
			new Response("not found", { status: 404 }),
		[`${origin}/sitemap-index.xml`]: () =>
			new Response("not found", { status: 404 }),
		[`${origin}/wp-sitemap.xml`]: () =>
			new Response("not found", { status: 404 }),
		[`https://www.${hostname}/`]: () => makeRedirect(`${origin}/`),
	};
}

function brokenSiteRoutes(): Record<string, RouteHandler> {
	return {
		"https://example.com/": () => makeHtml(PLAIN_HOMEWORK),
		"http://example.com/": () => makeHtml(PLAIN_HOMEWORK),
		"https://example.com/robots.txt": () =>
			new Response("not found", { status: 404 }),
		"https://example.com/llms.txt": () =>
			new Response("not found", { status: 404 }),
		"https://example.com/sitemap.xml": () =>
			new Response("not found", { status: 404 }),
		"https://example.com/sitemap_index.xml": () =>
			new Response("not found", { status: 404 }),
		"https://example.com/sitemap-index.xml": () =>
			new Response("not found", { status: 404 }),
		"https://example.com/wp-sitemap.xml": () =>
			new Response("not found", { status: 404 }),
		"https://www.example.com/": () => makeHtml(PLAIN_HOMEWORK),
	};
}

describe("runScanAction — free tier output", () => {
	it("returns a perfect score with readiness and no issues for a clean site", async () => {
		const result = await runScanAction({
			input: { domain: "example.com" },
			options: {
				fetcher: mockFetcher(cleanSiteRoutes()),
				lookup: publicLookup,
			},
		});

		expect(result.score).toBe(100);
		expect(result.readiness).toBe("ready");
		expect(result.issues).toEqual([]);
		expect(result.issueCount).toBe(0);
		expect(result.domain).toBe("example.com");
		expect(runScanOutputSchema.parse(result)).toEqual(result);
	});

	it("caps the free issues at 3 while reporting the total found", async () => {
		const result = await runScanAction({
			input: { domain: "example.com" },
			options: {
				fetcher: mockFetcher(brokenSiteRoutes()),
				lookup: publicLookup,
			},
		});

		expect(result.issueCount).toBe(6);
		expect(result.issues).toHaveLength(FREE_ISSUE_LIMIT);
		expect(result.issues.map((issue) => issue.check)).toEqual([
			"sitemap",
			"json-ld",
			"https",
		]);
		expect(result.score).toBe(35);
		expect(result.readiness).toBe("not-ready");
		expect(runScanOutputSchema.parse(result)).toEqual(result);
	});

	it("normalizes a full URL input to its hostname", async () => {
		const result = await runScanAction({
			input: { domain: "https://example.com/pricing?ref=1" },
			options: {
				fetcher: mockFetcher(cleanSiteRoutes()),
				lookup: publicLookup,
			},
		});

		expect(result.domain).toBe("example.com");
		expect(result.finalUrl).toBe("https://example.com/");
	});
});

describe("runScanAction — errors", () => {
	it("throws ScanTargetError when the site is unreachable", async () => {
		const fetcher: FetchLike = async () => {
			throw new Error("network down");
		};

		let thrown: unknown;
		try {
			await runScanAction({
				input: { domain: "example.com" },
				options: { fetcher, lookup: publicLookup },
			});
		} catch (err) {
			thrown = err;
		}

		expect((thrown as ScanTargetError)?.name).toBe("ScanTargetError");
		expect((thrown as Error).message).toContain("Could not reach");
	});

	it("throws ScanTargetError for a private hostname", async () => {
		expect(
			runScanAction({
				input: { domain: "localhost" },
				options: { fetcher: mockFetcher({}), lookup: publicLookup },
			}),
		).rejects.toThrow("not a public domain");
	});
});

describe("runScanInputSchema", () => {
	it("rejects an empty domain", () => {
		expect(runScanInputSchema.safeParse({ domain: "" }).success).toBe(false);
		expect(runScanInputSchema.safeParse({ domain: "   " }).success).toBe(false);
	});

	it("trims surrounding whitespace", () => {
		const parsed = runScanInputSchema.parse({ domain: "  example.com  " });
		expect(parsed.domain).toBe("example.com");
	});
});

describe("getReadinessLevel", () => {
	it("maps scores to readiness levels at the 70 and 40 thresholds", () => {
		expect(getReadinessLevel(100)).toBe("ready");
		expect(getReadinessLevel(70)).toBe("ready");
		expect(getReadinessLevel(69)).toBe("needs-work");
		expect(getReadinessLevel(40)).toBe("needs-work");
		expect(getReadinessLevel(39)).toBe("not-ready");
		expect(getReadinessLevel(0)).toBe("not-ready");
	});
});
