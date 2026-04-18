import { z } from "zod";
import { baseActionContextSchema } from "../../trpc";
import { getSitemapInfo, type SitemapType } from "@opencited/crawler";

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

	const validatedSitemaps: Array<{
		url: string;
		type: SitemapType;
		urlCount: number;
		source: "robots.txt" | "standard" | "sitemap-index";
	}> = [];

	for (const [url, source] of discoveredUrls) {
		const result = await checkSitemapValidity(url);
		if (result.valid && result.type && result.count !== undefined) {
			validatedSitemaps.push({
				url,
				type: result.type,
				urlCount: result.count,
				source,
			});
		}
	}

	validatedSitemaps.sort((a, b) => {
		const sourceOrder = { "robots.txt": 0, standard: 1, "sitemap-index": 2 };
		return sourceOrder[a.source] - sourceOrder[b.source];
	});

	return { sitemaps: validatedSitemaps };
};

export const discoverSitemapsHandler = async (params: {
	input: z.infer<typeof discoverSitemapsInputSchema>;
	ctx: z.infer<typeof discoverSitemapsContextSchema>;
}) => {
	return discoverSitemapsAction(params);
};
