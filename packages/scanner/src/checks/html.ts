import * as cheerio from "cheerio";

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
