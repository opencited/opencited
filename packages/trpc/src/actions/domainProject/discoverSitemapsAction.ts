import { z } from "zod";
import { baseActionContextSchema } from "../../trpc";
import {
	getSitemapInfo,
	getSitemapChildUrls,
	type SitemapType,
} from "@opencited/crawler";

export const discoverSitemapsInputSchema = z.object({
	domain: z.string().min(1),
});
export const discoverSitemapsOutputSchema = z.object({
	sitemaps: z.array(
		z.object({
			url: z.string(),
			type: z.enum(["urlset", "sitemapindex"]),
			urlCount: z.number(),
			source: z.enum(["robots.txt", "standard", "sitemap-index"]),
		}),
	),
	sitemapIndexes: z
		.array(
			z.object({
				url: z.string(),
				childSitemaps: z.array(z.string()),
			}),
		)
		.optional(),
});
export const discoverSitemapsContextSchema = baseActionContextSchema;

const STANDARD_SITEMAP_PATHS = [
	"/sitemap.xml",
	"/sitemap-index.xml",
	"/wp-sitemap.xml",
	"/sitemap_index.xml",
];

async function fetchWithTimeout(
	url: string,
	timeout: number = 5000,
): Promise<{ ok: boolean; contentType: string; status: number }> {
	try {
		const response = await fetch(url, {
			method: "HEAD",
			signal: AbortSignal.timeout(timeout),
		});
		return {
			ok: response.ok,
			contentType: response.headers.get("content-type") ?? "",
			status: response.status,
		};
	} catch {
		return { ok: false, contentType: "", status: 0 };
	}
}

async function getRobotsTxtSitemaps(baseUrl: string): Promise<string[]> {
	try {
		const response = await fetch(`${baseUrl}/robots.txt`, {
			signal: AbortSignal.timeout(5000),
		});
		if (!response.ok) return [];

		const text = await response.text();
		const lines = text.split("\n");
		const sitemaps: string[] = [];

		for (const line of lines) {
			const trimmed = line.trim();
			if (trimmed.toLowerCase().startsWith("sitemap:")) {
				const sitemapUrl = trimmed.slice(7).trim();
				if (sitemapUrl) {
					sitemaps.push(sitemapUrl);
				}
			}
		}

		return sitemaps;
	} catch {
		return [];
	}
}

async function checkSitemapValidity(url: string): Promise<{
	valid: boolean;
	type?: SitemapType;
	count?: number;
	error?: string;
}> {
	try {
		const info = await getSitemapInfo(url);
		return { valid: true, type: info.type, count: info.count };
	} catch (error) {
		return {
			valid: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

interface DiscoveredSitemap {
	url: string;
	type: SitemapType;
	urlCount: number;
	source: "robots.txt" | "standard" | "sitemap-index";
}

async function discoverChildSitemaps(
	parentUrl: string,
	_source: "robots.txt" | "standard" | "sitemap-index",
	visited: Set<string>,
): Promise<{
	urlsetSitemaps: DiscoveredSitemap[];
	sitemapIndexes: { url: string; childSitemaps: string[] }[];
}> {
	if (visited.has(parentUrl)) {
		return { urlsetSitemaps: [], sitemapIndexes: [] };
	}
	visited.add(parentUrl);

	const urlsetSitemaps: DiscoveredSitemap[] = [];
	const sitemapIndexes: { url: string; childSitemaps: string[] }[] = [];

	try {
		const childResult = await getSitemapChildUrls(parentUrl);

		if (
			childResult.type === "sitemapindex" &&
			childResult.childSitemaps.length > 0
		) {
			sitemapIndexes.push({
				url: parentUrl,
				childSitemaps: childResult.childSitemaps,
			});

			for (const childUrl of childResult.childSitemaps) {
				if (visited.has(childUrl)) continue;

				const childCheck = await checkSitemapValidity(childUrl);
				if (!childCheck.valid || !childCheck.type) continue;

				if (childCheck.type === "sitemapindex") {
					const childResult = await discoverChildSitemaps(
						childUrl,
						"sitemap-index",
						visited,
					);
					urlsetSitemaps.push(...childResult.urlsetSitemaps);
					sitemapIndexes.push(...childResult.sitemapIndexes);
				} else {
					urlsetSitemaps.push({
						url: childUrl,
						type: "urlset",
						urlCount: childCheck.count ?? 0,
						source: "sitemap-index",
					});
				}
			}
		}
	} catch {
		// Skip if we can't fetch child sitemaps
	}

	return { urlsetSitemaps, sitemapIndexes };
}

export const discoverSitemapsAction = async (params: {
	input: z.infer<typeof discoverSitemapsInputSchema>;
	ctx: z.infer<typeof discoverSitemapsContextSchema>;
}) => {
	const { input } = params;
	const { domain } = input;

	const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
	const baseUrl = `https://${cleanDomain}`;

	const discoveredUrls = new Map<
		string,
		"robots.txt" | "standard" | "sitemap-index"
	>();

	const [robotsTxtSitemaps, ...standardChecks] = await Promise.all([
		getRobotsTxtSitemaps(baseUrl),
		...STANDARD_SITEMAP_PATHS.map(async (path) => {
			const url = `${baseUrl}${path}`;
			const { ok } = await fetchWithTimeout(url);
			return { url, ok };
		}),
	]);

	for (const sitemap of robotsTxtSitemaps) {
		discoveredUrls.set(sitemap, "robots.txt");
	}

	for (const check of standardChecks) {
		if (check.ok && !discoveredUrls.has(check.url)) {
			discoveredUrls.set(check.url, "standard");
		}
	}

	const validatedSitemaps: DiscoveredSitemap[] = [];
	const discoveredSitemapIndexes: { url: string; childSitemaps: string[] }[] =
		[];
	const visited = new Set<string>();
	const childSitemapUrls = new Set<string>();

	for (const [url, source] of discoveredUrls) {
		if (visited.has(url)) continue;

		const result = await checkSitemapValidity(url);
		if (!result.valid || !result.type) continue;

		if (result.type === "sitemapindex") {
			const children = await discoverChildSitemaps(url, source, visited);

			for (const child of children.urlsetSitemaps) {
				childSitemapUrls.add(child.url);
			}

			for (const index of children.sitemapIndexes) {
				for (const childUrl of index.childSitemaps) {
					childSitemapUrls.add(childUrl);
				}
			}

			validatedSitemaps.push(...children.urlsetSitemaps);
			discoveredSitemapIndexes.push(...children.sitemapIndexes);
		} else {
			validatedSitemaps.push({
				url,
				type: result.type,
				urlCount: result.count ?? 0,
				source,
			});
		}
	}

	const filteredSitemaps = validatedSitemaps.filter(
		(s) =>
			s.type === "urlset" && s.urlCount > 0 && !childSitemapUrls.has(s.url),
	);

	filteredSitemaps.sort((a, b) => {
		const sourceOrder = { "robots.txt": 0, standard: 1, "sitemap-index": 2 };
		return sourceOrder[a.source] - sourceOrder[b.source];
	});

	return {
		sitemaps: filteredSitemaps,
		sitemapIndexes:
			discoveredSitemapIndexes.length > 0
				? discoveredSitemapIndexes
				: undefined,
	};
};

export const discoverSitemapsHandler = async (params: {
	input: z.infer<typeof discoverSitemapsInputSchema>;
	ctx: z.infer<typeof discoverSitemapsContextSchema>;
}) => {
	return discoverSitemapsAction(params);
};
