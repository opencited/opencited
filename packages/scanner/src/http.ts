import { FetchError, ScanTargetError } from "./errors";
import type { FetchLike } from "./types";
import { hostnameFromUrl, type ScanTargetGuard } from "./target";

const USER_AGENT =
	"Mozilla/5.0 (compatible; OpenCitedScanner/1.0; +https://opencited.com)";

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

export interface GuardedResponse {
	requestUrl: string;
	finalUrl: string;
	status: number;
	headers: Headers;
	body: string;
	redirects: string[];
	durationMs: number;
}

export interface FetchGuardedOptions {
	fetcher: FetchLike;
	guard: ScanTargetGuard;
	timeoutMs?: number;
	maxRedirects?: number;
}

export async function fetchGuarded(
	rawUrl: string,
	options: FetchGuardedOptions,
): Promise<GuardedResponse> {
	const { fetcher, guard, timeoutMs = 5000, maxRedirects = 5 } = options;
	const startedAt = performance.now();
	let url = await guard.assertUrl(rawUrl);
	const redirects: string[] = [];

	for (let hop = 0; hop <= maxRedirects; hop++) {
		let response: Response;
		try {
			response = await fetcher(url.toString(), {
				redirect: "manual",
				signal: AbortSignal.timeout(timeoutMs),
				headers: {
					"user-agent": USER_AGENT,
					accept:
						"text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5",
				},
			});
		} catch (err) {
			throw new FetchError(url.toString(), `Request failed for ${url}`, {
				cause: err,
			});
		}

		const location = response.headers.get("location");
		if (REDIRECT_STATUSES.has(response.status) && location) {
			if (hop === maxRedirects) {
				throw new FetchError(
					url.toString(),
					`Too many redirects (more than ${maxRedirects}) starting at ${rawUrl}`,
				);
			}
			let nextUrl: URL;
			try {
				nextUrl = new URL(location, url);
			} catch {
				throw new FetchError(
					url.toString(),
					`Invalid redirect location "${location}"`,
				);
			}
			redirects.push(nextUrl.toString());
			await response.body?.cancel().catch(() => {});
			url = await guard.assertUrl(nextUrl.toString());
			continue;
		}

		let body = "";
		try {
			body = await response.text();
		} catch {
			body = "";
		}
		return {
			requestUrl: rawUrl,
			finalUrl: url.toString(),
			status: response.status,
			headers: response.headers,
			body,
			redirects,
			durationMs: Math.round(performance.now() - startedAt),
		};
	}

	throw new FetchError(
		rawUrl,
		`Too many redirects (more than ${maxRedirects}) starting at ${rawUrl}`,
	);
}

export function isSuccessful(response: GuardedResponse): boolean {
	return response.status >= 200 && response.status < 300;
}

export function finalHostOf(response: GuardedResponse): string {
	return hostnameFromUrl(new URL(response.finalUrl));
}

export function resolveAgainst(
	baseUrl: string,
	candidate: string,
): string | null {
	try {
		return new URL(candidate, baseUrl).toString();
	} catch {
		return null;
	}
}

export function rethrowIfTargetError(err: unknown): void {
	if (err instanceof ScanTargetError) throw err;
}
