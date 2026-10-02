import type { FetchLike, LookupFn } from "@opencited/scanner";

export const PUBLIC_IP = "93.184.216.34";

export const publicLookup: LookupFn = async () => [PUBLIC_IP];

function makeHtml(body: string): Response {
	return new Response(body, {
		status: 200,
		headers: { "content-type": "text/html" },
	});
}

function makeText(body: string, status = 200): Response {
	return new Response(body, {
		status,
		headers: { "content-type": "text/plain" },
	});
}

function makeRedirect(location: string, status = 301): Response {
	return new Response(null, { status, headers: { location } });
}

type RouteHandler = () => Response | Promise<Response>;

export function mockFetcher(routes: Record<string, RouteHandler>): FetchLike {
	return async (url) => {
		const handler = routes[url];
		if (!handler) return new Response("not found", { status: 404 });
		return handler();
	};
}

const JSON_LD_HOMEWORK = `<html><head>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Organization","name":"Example"}
</script>
</head><body>hi</body></html>`;

export function cleanSiteRoutes(
	hostname = "example.com",
): Record<string, RouteHandler> {
	const origin = `https://${hostname}`;
	return {
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
}

export function brokenSiteRoutes(): Record<string, RouteHandler> {
	return {
		"https://example.com/": () => makeHtml(`<html><body>hi</body></html>`),
		"http://example.com/": () => makeHtml(`<html><body>hi</body></html>`),
		"https://example.com/robots.txt": () =>
			new Response("not found", { status: 404 }),
		"https://example.com/llms.txt": () =>
			new Response("not found", { status: 404 }),
		"https://example.com/sitemap.xml": () =>
			new Response("not found", { status: 404 }),
		"https://example.com/sitemap_index.xml": () =>
			new Response("not found", { status: 404 }),
		"https://example.com/sitemap-index.xml": () =>
			new Response("not found", { status: 404 }),
		"https://example.com/wp-sitemap.xml": () =>
			new Response("not found", { status: 404 }),
		"https://www.example.com/": () => makeHtml(`<html><body>hi</body></html>`),
	};
}
