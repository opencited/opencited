export const COMMON_SITEMAP_PATHS = [
	"/sitemap.xml",
	"/sitemap_index.xml",
	"/sitemap-index.xml",
	"/wp-sitemap.xml",
];

const MAX_DECLARED_SITEMAPS = 6;

export function looksLikeSitemap(body: string): boolean {
	const head = body.trimStart().slice(0, 2048);
	return /<(?:\?xml|urlset[\s>]|sitemapindex[\s>])/i.test(head);
}

export function selectSitemapCandidates(
	declared: string[],
	baseUrl: string,
): string[] {
	const candidates: string[] = [];
	const seen = new Set<string>();
	for (const declaredUrl of declared) {
		if (candidates.length >= MAX_DECLARED_SITEMAPS) break;
		try {
			const absolute = new URL(declaredUrl, baseUrl).toString();
			if (seen.has(absolute)) continue;
			seen.add(absolute);
			candidates.push(absolute);
		} catch {}
	}
	return candidates;
}

export function commonSitemapUrls(baseUrl: string): string[] {
	return COMMON_SITEMAP_PATHS.map((path) => new URL(path, baseUrl).toString());
}
