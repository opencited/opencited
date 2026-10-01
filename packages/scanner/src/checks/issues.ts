import type { ScanIssue } from "../types";

export function robotsMissingIssue(): ScanIssue {
	return {
		check: "robots-txt",
		goal: "Give AI crawlers explicit crawl instructions for your site",
		issue: "No robots.txt found at /robots.txt",
		howToFix:
			"Add a robots.txt file at your site root. Even if it allows everything, its presence tells crawlers where to start.",
		weight: 5,
	};
}

export function aiBotsBlockedIssue(blockedAgents: string[]): ScanIssue {
	return {
		check: "ai-bot-access",
		goal: "AI answer engines must be allowed to fetch your content",
		issue: `robots.txt blocks AI crawlers: ${blockedAgents.join(", ")}`,
		howToFix:
			"Remove the site-wide `Disallow: /` rule for these user agents (or add `Allow: /`) so AI engines can read your pages and cite them in answers.",
		weight: 25,
	};
}

export function sitemapMissingIssue(): ScanIssue {
	return {
		check: "sitemap",
		goal: "Help crawlers discover every page on your site",
		issue:
			"No sitemap found — not declared in robots.txt and not present at common paths",
		howToFix:
			"Create a sitemap.xml, submit it with a `Sitemap:` line in robots.txt, and verify it loads at /sitemap.xml.",
		weight: 15,
	};
}

export function llmsTxtMissingIssue(): ScanIssue {
	return {
		check: "llms-txt",
		goal: "Give LLMs a curated, machine-readable overview of your site",
		issue: "No llms.txt found at /llms.txt",
		howToFix:
			"Add an /llms.txt file in markdown that summarises your key pages, products, and docs so language models can understand what you offer.",
		weight: 10,
	};
}

export function jsonLdMissingIssue(): ScanIssue {
	return {
		check: "json-ld",
		goal: "Let engines understand your entities with structured data",
		issue: "No valid schema.org JSON-LD found on the homepage",
		howToFix:
			'Add a `<script type="application/ld+json">` block to your homepage with Organization and WebSite schema describing your brand.',
		weight: 15,
	};
}

export function httpsUnavailableIssue(): ScanIssue {
	return {
		check: "https",
		goal: "Serve your site securely over HTTPS",
		issue: "The site is not reachable over HTTPS",
		howToFix:
			"Install a valid TLS certificate and serve the site at https://, then redirect all HTTP traffic to HTTPS.",
		weight: 15,
	};
}

export function httpNotRedirectingIssue(): ScanIssue {
	return {
		check: "https",
		goal: "Serve your site securely over HTTPS",
		issue: "http:// does not redirect to https://",
		howToFix:
			"Add a 301 redirect from http:// to https:// at the server or CDN level so every visitor and crawler uses the secure URL.",
		weight: 15,
	};
}

export function duplicateHostIssue(
	canonicalHost: string,
	alternateHost: string,
): ScanIssue {
	return {
		check: "canonical-host",
		goal: "Serve one canonical host instead of duplicate apex/www content",
		issue: `Both ${canonicalHost} and ${alternateHost} serve content without a 301 redirect or canonical tag`,
		howToFix: `Pick one canonical host and 301-redirect the other to it (e.g. ${alternateHost} → ${canonicalHost}), or declare a canonical URL on your pages.`,
		weight: 5,
	};
}

export function xRobotsNoindexIssue(headerValue: string): ScanIssue {
	return {
		check: "x-robots-tag",
		goal: "Keep your pages indexable by search and AI engines",
		issue: `Homepage response sets X-Robots-Tag: ${headerValue}`,
		howToFix:
			"Remove the `noindex` directive from the X-Robots-Tag response header so search and AI engines can include the page in results.",
		weight: 10,
	};
}
