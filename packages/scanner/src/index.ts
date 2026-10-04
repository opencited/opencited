export { runTechnicalScan } from "./engine";
export { ScanTargetError, FetchError } from "./errors";
export {
	AI_AGENTS,
	findBlockedAgents,
	parseRobots,
	type ParsedRobots,
	type RobotsGroup,
	type RobotsRule,
} from "./checks/robots";
export {
	COMMON_SITEMAP_PATHS,
	commonSitemapUrls,
	looksLikeSitemap,
	selectSitemapCandidates,
} from "./checks/sitemap";
export {
	extractHomepageSnapshot,
	extractHtmlCanonical,
	extractJsonLd,
	extractLinkHeaderCanonical,
	type JsonLdExtraction,
} from "./checks/html";
export { isPublicAddress, normalizeHostname } from "./address";
export { createTargetGuard, resolveTarget, defaultLookup } from "./target";
export { fetchGuarded, type GuardedResponse } from "./http";
export type {
	CheckId,
	FetchLike,
	LookupFn,
	HomepageSnapshot,
	ScanIssue,
	ScanOptions,
	ScanResult,
} from "./types";
