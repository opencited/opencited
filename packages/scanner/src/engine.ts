import { isIP } from "node:net";
import {
	extractHtmlCanonical,
	extractJsonLd,
	extractLinkHeaderCanonical,
} from "./checks/html";
import {
	aiBotsBlockedIssue,
	duplicateHostIssue,
	httpNotRedirectingIssue,
	httpsUnavailableIssue,
	jsonLdMissingIssue,
	llmsTxtMissingIssue,
	robotsMissingIssue,
	sitemapMissingIssue,
	xRobotsNoindexIssue,
} from "./checks/issues";
import { findBlockedAgents, parseRobots } from "./checks/robots";
import {
	commonSitemapUrls,
	looksLikeSitemap,
	selectSitemapCandidates,
} from "./checks/sitemap";
import { ScanTargetError } from "./errors";
import {
	fetchGuarded,
	finalHostOf,
	isSuccessful,
	type GuardedResponse,
} from "./http";
import {
	createTargetGuard,
	defaultLookup,
	originOf,
	resolveTarget,
	schemeOf,
} from "./target";
import type { ScanIssue, ScanOptions, ScanResult } from "./types";

const DEFAULT_TIMEOUT_MS = 5000;

type AttemptResult = GuardedResponse | ScanTargetError | null;

function asResponse(result: AttemptResult): GuardedResponse | null {
	if (result instanceof ScanTargetError || result === null) return null;
	return result;
}

function throwIfTargetError(results: AttemptResult[]): void {
	const error = results.find((result) => result instanceof ScanTargetError);
	if (error instanceof ScanTargetError) throw error;
}

function alternateHostOf(host: string): string | null {
	if (isIP(host) !== 0) return null;
	if (host.startsWith("www.")) {
		const stripped = host.slice(4);
		return stripped.includes(".") ? stripped : null;
	}
	return `www.${host}`;
}

function isSitemapHit(response: GuardedResponse | null): boolean {
	return Boolean(
		response && isSuccessful(response) && looksLikeSitemap(response.body),
	);
}

export async function runTechnicalScan(
	input: string,
	options: ScanOptions = {},
): Promise<ScanResult> {
	const fetcher = options.fetcher ?? fetch;
	const lookup = options.lookup ?? defaultLookup;
	const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	const startedAt = performance.now();

	const target = await resolveTarget(input, lookup);
	const guard = createTargetGuard(lookup);

	const attempt = async (url: string, hard = false): Promise<AttemptResult> => {
		try {
			return await fetchGuarded(url, { fetcher, guard, timeoutMs });
		} catch (err) {
			if (err instanceof ScanTargetError && hard) return err;
			return null;
		}
	};

	const httpsOrigin = originOf(target.httpsUrl);
	const commonSitemapAtHttps = commonSitemapUrls(httpsOrigin);

	const homepagePromise = Promise.all<AttemptResult>([
		attempt(target.httpsUrl, true),
		attempt(target.httpUrl, true),
	]);
	const probesPromise = Promise.all<AttemptResult>([
		attempt(`${httpsOrigin}/robots.txt`),
		attempt(`${httpsOrigin}/llms.txt`),
		...commonSitemapAtHttps.map((url) => attempt(url)),
	]);

	const [homepageResults, probeResults] = await Promise.all([
		homepagePromise,
		probesPromise,
	]);
	throwIfTargetError(homepageResults);

	const httpsRes = asResponse(homepageResults[0] ?? null);
	const httpRes = asResponse(homepageResults[1] ?? null);
	if (!httpsRes && !httpRes) {
		throw new ScanTargetError(
			`Could not reach ${target.hostname} — the site did not respond over HTTP or HTTPS.`,
		);
	}

	let robotsCheck = asResponse(probeResults[0] ?? null);
	let llmsCheck = asResponse(probeResults[1] ?? null);
	let commonSitemaps = probeResults.slice(2).map(asResponse);
	const probedSitemapUrls = new Set(commonSitemapAtHttps);

	if (!httpsRes && httpRes) {
		const httpOrigin = originOf(httpRes.finalUrl);
		if (httpOrigin !== httpsOrigin) {
			const commonSitemapAtHttp = commonSitemapUrls(httpOrigin);
			const reprobeResults = await Promise.all<AttemptResult>([
				attempt(`${httpOrigin}/robots.txt`),
				attempt(`${httpOrigin}/llms.txt`),
				...commonSitemapAtHttp.map((url) => attempt(url)),
			]);
			robotsCheck = asResponse(reprobeResults[0] ?? null);
			llmsCheck = asResponse(reprobeResults[1] ?? null);
			commonSitemaps = reprobeResults.slice(2).map(asResponse);
			for (const url of commonSitemapAtHttp) probedSitemapUrls.add(url);
		}
	}

	const homepage = (httpsRes ?? httpRes) as GuardedResponse;

	const robotsOk = Boolean(
		robotsCheck &&
			robotsCheck.status === 200 &&
			robotsCheck.body.trim().length > 0,
	);
	const parsedRobots =
		robotsCheck && robotsOk ? parseRobots(robotsCheck.body) : null;

	let sitemapFound = commonSitemaps.some(isSitemapHit);

	const canonicalHost = finalHostOf(homepage);
	const alternateHost = alternateHostOf(canonicalHost);
	const homepageScheme = schemeOf(homepage.finalUrl);
	const alternateUrl = alternateHost
		? `${homepageScheme}://${alternateHost}/`
		: null;

	let declaredToProbe: string[] = [];
	if (!sitemapFound && parsedRobots && parsedRobots.sitemaps.length > 0) {
		const declared = selectSitemapCandidates(
			parsedRobots.sitemaps,
			robotsCheck ? robotsCheck.requestUrl : originOf(homepage.finalUrl),
		);
		declaredToProbe = declared.filter((url) => !probedSitemapUrls.has(url));
	}

	const declaredPromise = Promise.all<AttemptResult>(
		declaredToProbe.map((url) => attempt(url)),
	);
	const alternatePromise: Promise<AttemptResult> = alternateUrl
		? attempt(alternateUrl)
		: Promise.resolve(null);
	const [declaredResults, alternateResult] = await Promise.all([
		declaredPromise,
		alternatePromise,
	]);

	if (declaredResults.some((result) => isSitemapHit(asResponse(result)))) {
		sitemapFound = true;
	}
	const alternateRes = asResponse(alternateResult);

	const issues: ScanIssue[] = [];

	if (!robotsOk) issues.push(robotsMissingIssue());

	const blockedAgents = parsedRobots ? findBlockedAgents(parsedRobots) : [];
	if (blockedAgents.length > 0) issues.push(aiBotsBlockedIssue(blockedAgents));

	if (!sitemapFound) issues.push(sitemapMissingIssue());

	const llmsOk = Boolean(
		llmsCheck && isSuccessful(llmsCheck) && llmsCheck.body.trim().length > 0,
	);
	if (!llmsOk) issues.push(llmsTxtMissingIssue());

	const homepageHtml = homepage.body;
	if (!extractJsonLd(homepageHtml).valid) issues.push(jsonLdMissingIssue());

	if (!httpsRes) {
		issues.push(httpsUnavailableIssue());
	} else if (httpRes && !httpRes.finalUrl.startsWith("https://")) {
		issues.push(httpNotRedirectingIssue());
	}

	const xRobotsTag = homepage.headers.get("x-robots-tag");
	if (xRobotsTag && /\bnoindex\b/i.test(xRobotsTag)) {
		issues.push(xRobotsNoindexIssue(xRobotsTag));
	}

	const htmlCanonical = extractHtmlCanonical(homepageHtml);
	const headerCanonical = extractLinkHeaderCanonical(
		homepage.headers.get("link"),
	);
	const canonicalDeclared = Boolean(htmlCanonical || headerCanonical);
	if (
		alternateRes &&
		alternateHost &&
		isSuccessful(alternateRes) &&
		finalHostOf(alternateRes) === alternateHost &&
		!canonicalDeclared
	) {
		issues.push(duplicateHostIssue(canonicalHost, alternateHost));
	}

	issues.sort((a, b) => b.weight - a.weight);
	const deduction = issues.reduce((sum, issue) => sum + issue.weight, 0);
	const score = Math.max(0, Math.min(100, 100 - deduction));

	return {
		domain: target.hostname,
		finalUrl: homepage.finalUrl,
		score,
		issues,
		durationMs: Math.round(performance.now() - startedAt),
		fetchedAt: new Date().toISOString(),
	};
}
