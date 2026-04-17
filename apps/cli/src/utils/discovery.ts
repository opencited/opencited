const COMMON_SITEMAP_PATHS = [
	"/sitemap.xml",
	"/sitemap-index.xml",
	"/wp-sitemap.xml",
	"/sitemap_index.xml",
];

export async function discoverSitemap(domain: string): Promise<string | null> {
	const normalizedDomain = domain.endsWith("/") ? domain.slice(0, -1) : domain;

	for (const path of COMMON_SITEMAP_PATHS) {
		const url = normalizedDomain + path;
		try {
			const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
			if (response.ok) {
				const contentType = response.headers.get("content-type") ?? "";
				if (contentType.includes("xml") || contentType.includes("text/plain")) {
					return url;
				}
			}
		} catch {}
	}
	return null;
}
