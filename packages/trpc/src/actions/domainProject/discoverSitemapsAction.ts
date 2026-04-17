import { z } from "zod";
import { baseActionContextSchema } from "../../trpc";

export const discoverSitemapsInputSchema = z.object({
	domain: z.string().min(1),
});
export const discoverSitemapsOutputSchema = z.object({
	sitemaps: z.array(
		z.object({
			url: z.string(),
			accessible: z.boolean(),
		}),
	),
});
export const discoverSitemapsContextSchema = baseActionContextSchema;

const COMMON_SITEMAP_PATHS = [
	"/sitemap.xml",
	"/sitemap-index.xml",
	"/wp-sitemap.xml",
	"/sitemap_index.xml",
];

async function checkSitemapAccessible(url: string): Promise<boolean> {
	try {
		const response = await fetch(url, {
			method: "HEAD",
			signal: AbortSignal.timeout(5000),
		});
		return response.ok;
	} catch {
		return false;
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

	const sitemapUrls = COMMON_SITEMAP_PATHS.map((path) => `${baseUrl}${path}`);

	const results = await Promise.all(
		sitemapUrls.map(async (url) => {
			const accessible = await checkSitemapAccessible(url);
			return { url, accessible };
		}),
	);

	const foundSitemaps = results.filter((r) => r.accessible).map((r) => r);

	return { sitemaps: foundSitemaps };
};

export const discoverSitemapsHandler = async (params: {
	input: z.infer<typeof discoverSitemapsInputSchema>;
	ctx: z.infer<typeof discoverSitemapsContextSchema>;
}) => {
	return discoverSitemapsAction(params);
};
