import type { FetchLike, LookupFn } from "../src";

export const PUBLIC_IP = "93.184.216.34";

export const publicLookup: LookupFn = async () => [PUBLIC_IP];

export function makeHtml(
	body: string,
	headers: Record<string, string> = {},
): Response {
	return new Response(body, {
		status: 200,
		headers: { "content-type": "text/html", ...headers },
	});
}

export function makeText(
	body: string,
	status = 200,
	headers: Record<string, string> = {},
): Response {
	return new Response(body, {
		status,
		headers: { "content-type": "text/plain", ...headers },
	});
}

export function makeRedirect(location: string, status = 301): Response {
	return new Response(null, { status, headers: { location } });
}

export type RouteHandler = () => Response | Promise<Response>;

export interface MockFetcher {
	fetcher: FetchLike;
	calls: string[];
}

export function mockFetcher(routes: Record<string, RouteHandler>): MockFetcher {
	const calls: string[] = [];
	const fetcher: FetchLike = async (url) => {
		calls.push(url);
		const handler = routes[url];
		if (!handler) return new Response("not found", { status: 404 });
		return handler();
	};
	return { fetcher, calls };
}

export const JSON_LD_HOMEWORK = `<html><head>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Organization","name":"Example"}
</script>
</head><body>hi</body></html>`;

export const PLAIN_HOMEWORK = `<html><head><title>Example</title></head><body>hi</body></html>`;

export function cleanSiteRoutes(
	hostname = "example.com",
): Record<string, RouteHandler> {
	const origin = `https://${hostname}`;
	const routes: Record<string, RouteHandler> = {
		[`${origin}/`]: () => makeHtml(JSON_LD_HOMEWORK),
		[`http://${hostname}/`]: () => makeRedirect(`${origin}/`),
		[`${origin}/robots.txt`]: () =>
			makeText(`User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`),
		[`${origin}/llms.txt`]: () => makeText("# Example\n"),
		[`${origin}/sitemap.xml`]: () =>
			makeText(
				`<?xml version="1.0"?><urlset><url><loc>${origin}/a</loc></url></urlset>`,
			),
		[`${origin}/sitemap_index.xml`]: () =>
			new Response("not found", { status: 404 }),
		[`${origin}/sitemap-index.xml`]: () =>
			new Response("not found", { status: 404 }),
		[`${origin}/wp-sitemap.xml`]: () =>
			new Response("not found", { status: 404 }),
		[`https://www.${hostname}/`]: () => makeRedirect(`${origin}/`),
	};
	return routes;
}
