import * as cheerio from "cheerio";
import type { HomepageSnapshot } from "../types";

export interface JsonLdExtraction {
	valid: boolean;
	types: string[];
}

function collectTypes(value: unknown, types: Set<string>): void {
	if (Array.isArray(value)) {
		for (const entry of value) collectTypes(entry, types);
		return;
	}
	if (!value || typeof value !== "object") return;
	const record = value as Record<string, unknown>;
	const type = record["@type"];
	if (typeof type === "string" && type) types.add(type);
	if (Array.isArray(type)) {
		for (const entry of type) {
			if (typeof entry === "string" && entry) types.add(entry);
		}
	}
	const graph = record["@graph"];
	if (graph) collectTypes(graph, types);
}

export function extractJsonLd(html: string): JsonLdExtraction {
	const types = new Set<string>();
	let valid = false;
	if (!html.trim()) return { valid, types: [] };

	const $ = cheerio.load(html);
	const blocks = $('script[type="application/ld+json"]').toArray();
	for (const block of blocks) {
		const raw = $(block).text();
		if (!raw.trim()) continue;
		try {
			const parsed: unknown = JSON.parse(raw);
			collectTypes(parsed, types);
			valid = true;
		} catch {}
	}
	return { valid, types: [...types] };
}

export function extractHtmlCanonical(html: string): string | null {
	if (!html.trim()) return null;
	const $ = cheerio.load(html);
	const href = $('link[rel="canonical"]').first().attr("href");
	return href?.trim() || null;
}

export function extractLinkHeaderCanonical(
	headerValue: string | null,
): string | null {
	if (!headerValue) return null;
	const pattern = /<([^>]+)>\s*;\s*rel\s*=\s*"?canonical"?/gi;
	const match = pattern.exec(headerValue);
	return match?.[1]?.trim() || null;
}

const MAX_TEXT_EXCERPT = 4000;

function collectJsonLdValues(
	value: unknown,
	predicate: (record: Record<string, unknown>) => string | null,
): string | null {
	if (Array.isArray(value)) {
		for (const entry of value) {
			const found = collectJsonLdValues(entry, predicate);
			if (found) return found;
		}
		return null;
	}
	if (!value || typeof value !== "object") return null;
	const record = value as Record<string, unknown>;
	const direct = predicate(record);
	if (direct) return direct;
	const graph = record["@graph"];
	if (graph) return collectJsonLdValues(graph, predicate);
	return null;
}

function organizationNameFromRecord(
	record: Record<string, unknown>,
): string | null {
	const type = record["@type"];
	const types = Array.isArray(type) ? type : type ? [type] : [];
	const isOrg = types.some(
		(entry) =>
			typeof entry === "string" &&
			/^(Organization|LocalBusiness|Corporation|Brand)$/i.test(entry),
	);
	if (!isOrg) return null;
	const name = record.name;
	return typeof name === "string" && name.trim() ? name.trim() : null;
}

function extractBrandNameFromJsonLd(html: string): string | null {
	const $ = cheerio.load(html);
	const blocks = $('script[type="application/ld+json"]').toArray();
	for (const block of blocks) {
		const raw = $(block).text();
		if (!raw.trim()) continue;
		try {
			const parsed: unknown = JSON.parse(raw);
			const name = collectJsonLdValues(parsed, organizationNameFromRecord);
			if (name) return name;
		} catch {}
	}
	return null;
}

function normalizeWhitespace(text: string): string {
	return text.replace(/\s+/g, " ").trim();
}

export function extractHomepageSnapshot(html: string): HomepageSnapshot {
	if (!html.trim()) {
		return {
			title: null,
			metaDescription: null,
			h1: null,
			brandName: null,
			textExcerpt: "",
		};
	}

	const $ = cheerio.load(html);
	$("script, style, noscript").remove();

	const title = normalizeWhitespace($("title").first().text()) || null;
	const metaDescription =
		normalizeWhitespace($('meta[name="description"]').attr("content") ?? "") ||
		null;
	const h1 = normalizeWhitespace($("h1").first().text()) || null;
	const ogSiteName =
		normalizeWhitespace(
			$('meta[property="og:site_name"]').attr("content") ?? "",
		) || null;
	const brandName = extractBrandNameFromJsonLd(html) ?? (ogSiteName || null);

	const bodyText = normalizeWhitespace($("body").text());
	const textExcerpt = bodyText.slice(0, MAX_TEXT_EXCERPT);

	return {
		title,
		metaDescription,
		h1,
		brandName,
		textExcerpt,
	};
}
