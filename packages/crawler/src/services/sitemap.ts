import { XMLParser } from "fast-xml-parser";
import type { CrawledUrl, CrawlResult, Changefreq } from "../types";

const VALID_CHANGEFREQ = new Set([
	"always",
	"hourly",
	"daily",
	"weekly",
	"monthly",
	"yearly",
]);

function parseLastmod(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	if (!trimmed) return null;
	return trimmed;
}

function parseChangefreq(value: unknown): Changefreq | null {
	if (typeof value !== "string") return null;
	const trimmed = value.trim().toLowerCase();
	if (!trimmed) return null;
	if (VALID_CHANGEFREQ.has(trimmed)) {
		return trimmed as Changefreq;
	}
	return null;
}

function parsePriority(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	if (!trimmed) return null;
	const num = parseFloat(trimmed);
	if (Number.isNaN(num) || num < 0 || num > 1) return null;
	return trimmed;
}

interface SitemapUrl {
	loc?: string | string[];
	lastmod?: string | string[];
	changefreq?: string | string[];
	priority?: string | string[];
	"xmlns:news"?: string;
	"xmlns:image"?: string;
	"xmlns:xhtml"?: string;
	"xmlns:mobile"?: string;
}

interface Sitemap {
	url?: SitemapUrl | SitemapUrl[];
}

export async function crawlSitemap(sitemapUrl: string): Promise<CrawlResult> {
	const response = await fetch(sitemapUrl, {
		signal: AbortSignal.timeout(10000),
	});

	if (!response.ok) {
		throw new Error(
			`Failed to fetch sitemap: ${response.status} ${response.statusText}`,
		);
	}

	const contentType = response.headers.get("content-type") ?? "";
	if (!contentType.includes("xml") && !contentType.includes("text/plain")) {
		throw new Error(`Invalid content type: ${contentType}`);
	}

	const xmlText = await response.text();

	const parser = new XMLParser({
		ignoreAttributes: false,
		attributeNamePrefix: "@_",
	});

	let parsed: Sitemap;
	try {
		parsed = parser.parse(xmlText) as Sitemap;
	} catch {
		throw new Error("Failed to parse XML");
	}

	if (!parsed.url) {
		throw new Error("Invalid sitemap: missing <url> elements");
	}

	const urlEntries = Array.isArray(parsed.url) ? parsed.url : [parsed.url];

	const urls: CrawledUrl[] = [];

	for (const entry of urlEntries) {
		const loc = Array.isArray(entry.loc) ? entry.loc[0] : entry.loc;

		if (typeof loc !== "string" || !loc.trim()) {
			continue;
		}

		const lastmodRaw = Array.isArray(entry.lastmod)
			? entry.lastmod[0]
			: entry.lastmod;
		const changefreqRaw = Array.isArray(entry.changefreq)
			? entry.changefreq[0]
			: entry.changefreq;
		const priorityRaw = Array.isArray(entry.priority)
			? entry.priority[0]
			: entry.priority;

		const lastmod = parseLastmod(lastmodRaw);
		const changefreq = parseChangefreq(changefreqRaw);
		const priority = parsePriority(priorityRaw);

		urls.push({
			url: loc.trim(),
			lastmod,
			changefreq,
			priority,
		});
	}

	return { urls };
}
