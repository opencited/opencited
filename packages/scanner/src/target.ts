import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import {
	isPublicAddress,
	normalizeHostname,
	validateHostnameShape,
} from "./address";
import { ScanTargetError } from "./errors";
import type { LookupFn } from "./types";

export interface ScanTarget {
	hostname: string;
	httpsUrl: string;
	httpUrl: string;
}

export interface ScanTargetGuard {
	assertUrl(rawUrl: string): Promise<URL>;
}

export const defaultLookup: LookupFn = async (hostname) => {
	try {
		const results = await dnsLookup(hostname, { all: true, verbatim: true });
		return results.map((entry) => entry.address);
	} catch {
		throw new ScanTargetError(
			`"${hostname}" could not be resolved (DNS lookup failed).`,
		);
	}
};

export function hostnameFromUrl(url: URL): string {
	const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
	if (hostname.startsWith("[") && hostname.endsWith("]")) {
		return hostname.slice(1, -1);
	}
	return hostname;
}

export function originOf(url: string): string {
	const parsed = new URL(url);
	return parsed.origin;
}

export function hostOf(url: string): string {
	return hostnameFromUrl(new URL(url));
}

export function schemeOf(url: string): string {
	return new URL(url).protocol.replace(":", "");
}

async function resolvePublicAddresses(
	hostname: string,
	lookup: LookupFn,
	cache: Map<string, string[]>,
): Promise<void> {
	if (isIP(hostname) !== 0) {
		if (!isPublicAddress(hostname)) {
			throw new ScanTargetError(
				`"${hostname}" is a private network address and cannot be scanned.`,
			);
		}
		return;
	}
	let addresses = cache.get(hostname);
	if (!addresses) {
		try {
			addresses = await lookup(hostname);
		} catch (err) {
			if (err instanceof ScanTargetError) throw err;
			throw new ScanTargetError(
				`"${hostname}" could not be resolved (DNS lookup failed).`,
			);
		}
		cache.set(hostname, addresses);
	}
	if (addresses.length === 0) {
		throw new ScanTargetError(
			`"${hostname}" could not be resolved (DNS lookup returned no addresses).`,
		);
	}
	const privateAddress = addresses.find((address) => !isPublicAddress(address));
	if (privateAddress) {
		throw new ScanTargetError(
			`"${hostname}" resolves to a private network address (${privateAddress}) and cannot be scanned.`,
		);
	}
}

export function createTargetGuard(lookup: LookupFn): ScanTargetGuard {
	const cache = new Map<string, string[]>();
	return {
		async assertUrl(rawUrl: string): Promise<URL> {
			let url: URL;
			try {
				url = new URL(rawUrl);
			} catch {
				throw new ScanTargetError(`"${rawUrl}" is not a valid URL.`);
			}
			if (url.protocol !== "http:" && url.protocol !== "https:") {
				throw new ScanTargetError(
					`Blocked: only http and https URLs can be fetched (got "${url.protocol.replace(":", "")}").`,
				);
			}
			if (url.username || url.password) {
				throw new ScanTargetError("Blocked: URL with embedded credentials.");
			}
			if (url.port && url.port !== "80" && url.port !== "443") {
				throw new ScanTargetError(
					`Blocked: only standard ports are allowed (got port ${url.port}).`,
				);
			}
			const hostname = hostnameFromUrl(url);
			if (!hostname) {
				throw new ScanTargetError(`"${rawUrl}" is not a valid URL.`);
			}
			try {
				validateHostnameShape(hostname);
			} catch (err) {
				if (err instanceof ScanTargetError) {
					throw new ScanTargetError(`Blocked: ${err.message}`);
				}
				throw err;
			}
			await resolvePublicAddresses(hostname, lookup, cache);
			return url;
		},
	};
}

export async function resolveTarget(
	input: string,
	lookup: LookupFn = defaultLookup,
): Promise<ScanTarget> {
	const hostname = normalizeHostname(input);
	await resolvePublicAddresses(hostname, lookup, new Map());
	const hostForUrl = isIP(hostname) === 6 ? `[${hostname}]` : hostname;
	return {
		hostname,
		httpsUrl: `https://${hostForUrl}/`,
		httpUrl: `http://${hostForUrl}/`,
	};
}
