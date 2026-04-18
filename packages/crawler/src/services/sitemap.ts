import { XMLParser } from "fast-xml-parser";
import type {
	CrawledUrl,
	CrawlResult,
	Changefreq,
	SitemapType,
} from "../types";

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
	if (value == null) return null;
	let strValue: string;
	if (typeof value === "number") {
		strValue = String(value);
	} else if (typeof value === "string") {
		strValue = value.trim();
	} else {
		return null;
	}
	if (!strValue) return null;
	const num = parseFloat(strValue);
	if (Number.isNaN(num) || num < 0 || num > 1) return null;
	return strValue;
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
	urlset?: {
		url?: SitemapUrl | SitemapUrl[];
		sitemap?: SitemapUrl | SitemapUrl[];
	};
	url?: SitemapUrl | SitemapUrl[];
	sitemapindex?: {
		sitemap?: SitemapUrl | SitemapUrl[];
	};
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

	let urlEntries: SitemapUrl[] = [];

	if (parsed.url) {
		urlEntries = Array.isArray(parsed.url) ? parsed.url : [parsed.url];
	} else if (parsed.urlset?.url) {
		urlEntries = Array.isArray(parsed.urlset.url)
			? parsed.urlset.url
			: [parsed.urlset.url];
	}

	if (urlEntries.length === 0) {
		throw new Error("Invalid sitemap: missing <url> elements");
	}

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

interface ParsedSitemap {
	type: SitemapType;
	entries: SitemapUrl[];
}

function parseSitemapXml(xmlText: string): ParsedSitemap {
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

	if (parsed.urlset?.sitemap || parsed.sitemapindex?.sitemap) {
		const sitemapEntries =
			parsed.urlset?.sitemap ?? parsed.sitemapindex?.sitemap;
		const entries = Array.isArray(sitemapEntries)
			? sitemapEntries
			: [sitemapEntries];
		return { type: "sitemapindex", entries: entries as SitemapUrl[] };
	}

	if (parsed.url || parsed.urlset?.url) {
		const urlEntries = parsed.url ?? parsed.urlset?.url;
		const entries = Array.isArray(urlEntries) ? urlEntries : [urlEntries];
		return { type: "urlset", entries: entries as SitemapUrl[] };
	}

	throw new Error("Invalid sitemap: missing <url> or <sitemap> elements");
}

function extractLoc(entry: SitemapUrl): string | null {
	const loc = Array.isArray(entry.loc) ? entry.loc[0] : entry.loc;
	if (typeof loc !== "string" || !loc.trim()) return null;
	return loc.trim();
}

function extractLastmod(entry: SitemapUrl): string | null {
	const raw = Array.isArray(entry.lastmod) ? entry.lastmod[0] : entry.lastmod;
	return parseLastmod(raw);
}

function extractChangefreq(entry: SitemapUrl): Changefreq | null {
	const raw = Array.isArray(entry.changefreq)
		? entry.changefreq[0]
		: entry.changefreq;
	return parseChangefreq(raw);
}

function extractPriority(entry: SitemapUrl): string | null {
	const raw = Array.isArray(entry.priority)
		? entry.priority[0]
		: entry.priority;
	return parsePriority(raw);
}

export async function getSitemapInfo(sitemapUrl: string): Promise<{
	type: SitemapType;
	count: number;
}> {
	const response = await fetch(sitemapUrl, {
		signal: AbortSignal.timeout(10000),
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch sitemap: ${response.status}`);
	}

	const contentType = response.headers.get("content-type") ?? "";
	if (!contentType.includes("xml") && !contentType.includes("text/plain")) {
		throw new Error(`Invalid content type: ${contentType}`);
	}

	const xmlText = await response.text();
	const { type, entries } = parseSitemapXml(xmlText);

	return {
		type,
		count: entries.length,
	};
}

export async function getSitemapUrls(sitemapUrl: string): Promise<{
	type: SitemapType;
	urls: CrawledUrl[];
}> {
	const response = await fetch(sitemapUrl, {
		signal: AbortSignal.timeout(10000),
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch sitemap: ${response.status}`);
	}

	const contentType = response.headers.get("content-type") ?? "";
	if (!contentType.includes("xml") && !contentType.includes("text/plain")) {
		throw new Error(`Invalid content type: ${contentType}`);
	}

	const xmlText = await response.text();
	const { type, entries } = parseSitemapXml(xmlText);

	const urls: CrawledUrl[] = [];

	for (const entry of entries) {
		const loc = extractLoc(entry);
		if (!loc) continue;

		urls.push({
			url: loc,
			lastmod: extractLastmod(entry),
			changefreq: extractChangefreq(entry),
			priority: extractPriority(entry),
		});
	}

	if (urls.length === 0) {
		throw new Error("No URLs found in sitemap");
	}

	return { type, urls };
}
