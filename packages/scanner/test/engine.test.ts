import { describe, expect, it } from "bun:test";
import { runTechnicalScan } from "../src";
import { ScanTargetError } from "../src/errors";
import {
	cleanSiteRoutes,
	JSON_LD_HOMEWORK,
	makeHtml,
	makeRedirect,
	makeText,
	PLAIN_HOMEWORK,
	mockFetcher,
	publicLookup,
} from "./helpers";

const lookup = publicLookup;

describe("runTechnicalScan — clean site", () => {
	it("scores a fully-ready site 100 with no issues", async () => {
		const { fetcher } = mockFetcher(cleanSiteRoutes());
		const result = await runTechnicalScan("example.com", {
			fetcher,
			lookup,
		});
		expect(result.score).toBe(100);
		expect(result.issues).toEqual([]);
		expect(result.domain).toBe("example.com");
		expect(result.finalUrl).toBe("https://example.com/");
		expect(result.durationMs).toBeLessThan(15_000);
	});

	it("reports blocked AI crawlers when robots.txt disallows them", async () => {
		const routes = cleanSiteRoutes();
		routes["https://example.com/robots.txt"] = () =>
			makeText(
				"User-agent: GPTBot\nDisallow: /\n\nUser-agent: ClaudeBot\nDisallow: /\n\nUser-agent: *\nAllow: /\n\nSitemap: https://example.com/sitemap.xml\n",
			);
		const { fetcher } = mockFetcher(routes);
		const result = await runTechnicalScan("example.com", {
			fetcher,
			lookup,
		});
		expect(result.score).toBe(75);
		expect(result.issues).toHaveLength(1);
		expect(result.issues[0]?.check).toBe("ai-bot-access");
		expect(result.issues[0]?.weight).toBe(25);
		expect(result.issues[0]?.issue).toContain("GPTBot");
		expect(result.issues[0]?.issue).toContain("ClaudeBot");
	});
});

describe("runTechnicalScan — broken site", () => {
	it("deducts for every failed check and sorts issues by weight", async () => {
		const { fetcher } = mockFetcher({
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
		});
		const result = await runTechnicalScan("example.com", {
			fetcher,
			lookup,
		});
		expect(result.score).toBe(35);
		const checks = result.issues.map((issue) => issue.check);
		expect(checks).toEqual([
			"sitemap",
			"json-ld",
			"https",
			"llms-txt",
			"robots-txt",
			"canonical-host",
		]);
		const weights = result.issues.map((issue) => issue.weight);
		expect(weights).toEqual([15, 15, 15, 10, 5, 5]);
		for (const issue of result.issues) {
			expect(issue.goal.length).toBeGreaterThan(0);
			expect(issue.howToFix.length).toBeGreaterThan(0);
		}
	});

	it("flags X-Robots-Tag noindex", async () => {
		const routes = cleanSiteRoutes();
		routes["https://example.com/"] = () =>
			makeHtml(JSON_LD_HOMEWORK, { "x-robots-tag": "noindex" });
		const { fetcher } = mockFetcher(routes);
		const result = await runTechnicalScan("example.com", {
			fetcher,
			lookup,
		});
		expect(result.score).toBe(90);
		expect(result.issues[0]?.check).toBe("x-robots-tag");
		expect(result.issues[0]?.issue).toContain("noindex");
	});

	it("accepts a canonical Link header as canonical declaration", async () => {
		const routes = cleanSiteRoutes();
		routes["https://example.com/"] = () =>
			makeHtml(PLAIN_HOMEWORK, {
				link: '<https://example.com/>; rel="canonical"',
			});
		routes["https://www.example.com/"] = () => makeHtml(PLAIN_HOMEWORK);
		const { fetcher } = mockFetcher(routes);
		const result = await runTechnicalScan("example.com", {
			fetcher,
			lookup,
		});
		expect(
			result.issues.find((i) => i.check === "canonical-host"),
		).toBeUndefined();
	});

	it("accepts an HTML canonical tag as canonical declaration", async () => {
		const routes = cleanSiteRoutes();
		routes["https://example.com/"] = () =>
			makeHtml(
				`<html><head><link rel="canonical" href="https://example.com/" />
				<script type="application/ld+json">{"@type":"Organization"}</script>
				</head><body>hi</body></html>`,
			);
		routes["https://www.example.com/"] = () => makeHtml(PLAIN_HOMEWORK);
		const { fetcher } = mockFetcher(routes);
		const result = await runTechnicalScan("example.com", {
			fetcher,
			lookup,
		});
		expect(
			result.issues.find((i) => i.check === "canonical-host"),
		).toBeUndefined();
	});

	it("flags HTTPS-unavailable sites", async () => {
		const { fetcher } = mockFetcher({
			"https://example.com/": () => {
				throw new Error("TLS handshake failed");
			},
			"http://example.com/": () =>
				makeHtml(
					`<html><head><script type="application/ld+json">{"@type":"Organization"}</script></head></html>`,
				),
			"http://example.com/robots.txt": () =>
				makeText("User-agent: *\nAllow: /\n"),
			"http://example.com/llms.txt": () => makeText("# hi\n"),
			"http://example.com/sitemap.xml": () => makeText("<urlset></urlset>"),
			"http://example.com/sitemap_index.xml": () =>
				new Response("nf", { status: 404 }),
			"http://example.com/sitemap-index.xml": () =>
				new Response("nf", { status: 404 }),
			"http://example.com/wp-sitemap.xml": () =>
				new Response("nf", { status: 404 }),
			"https://www.example.com/": () => {
				throw new Error("TLS handshake failed");
			},
			"http://www.example.com/": () => makeRedirect("http://example.com/"),
		});
		const result = await runTechnicalScan("example.com", {
			fetcher,
			lookup,
		});
		expect(
			result.issues.some((i) => i.check === "https" && i.weight === 15),
		).toBe(true);
		expect(result.finalUrl).toBe("http://example.com/");
	});
});

describe("runTechnicalScan — invalid targets", () => {
	it("rejects private IP targets with a clean error", async () => {
		const { fetcher, calls } = mockFetcher({});
		await expect(
			runTechnicalScan("192.168.1.1", { fetcher, lookup }),
		).rejects.toThrow(ScanTargetError);
		await Promise.resolve();
		expect(calls).toEqual([]);
	});

	it("rejects localhost with a clean error", async () => {
		const { fetcher } = mockFetcher({});
		await expect(
			runTechnicalScan("localhost", { fetcher, lookup }),
		).rejects.toThrow(ScanTargetError);
	});

	it("rejects empty input with a clean error", async () => {
		await expect(runTechnicalScan("", { lookup })).rejects.toThrow(
			ScanTargetError,
		);
	});

	it("rejects unresolvable domains with a clean error", async () => {
		const { fetcher } = mockFetcher({});
		await expect(
			runTechnicalScan("example.com", {
				fetcher,
				lookup: async () => {
					throw new Error("ENOTFOUND");
				},
			}),
		).rejects.toThrow(ScanTargetError);
	});

	it("rejects domains resolving to private addresses", async () => {
		const { fetcher } = mockFetcher({});
		await expect(
			runTechnicalScan("internal.example.com", {
				fetcher,
				lookup: async () => ["10.0.0.7"],
			}),
		).rejects.toThrow(/private network address/);
	});

	it("aborts when the homepage redirects to a private address", async () => {
		const { fetcher, calls } = mockFetcher({
			"https://example.com/": () =>
				makeRedirect("http://169.254.169.254/latest/meta-data/"),
		});
		await expect(
			runTechnicalScan("example.com", { fetcher, lookup }),
		).rejects.toThrow(ScanTargetError);
		await Promise.resolve();
		expect(calls).not.toContain("http://169.254.169.254/latest/meta-data/");
	});

	it("rejects when the site is unreachable over both schemes", async () => {
		const fetcher = async (): Promise<Response> => {
			throw new Error("connection refused");
		};
		await expect(
			runTechnicalScan("example.com", { fetcher, lookup }),
		).rejects.toThrow(/Could not reach/);
	});
});
