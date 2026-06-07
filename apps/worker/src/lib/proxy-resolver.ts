import type { Redis } from "ioredis";
import type { ProxyOptions } from "@opencited/browser-crawler";

const STICKY_PROXY_PREFIX = "proxy:sticky";
const STICKY_PROXY_TTL_SECONDS = 30 * 60; // 30 minutes

function stickyKey(domainProjectId: string): string {
	return `${STICKY_PROXY_PREFIX}:${domainProjectId}`;
}

export async function fetchProxyList(url: string): Promise<string[]> {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(
			`Failed to fetch proxy list: ${response.status} ${response.statusText}`,
		);
	}

	const text = await response.text();
	const proxies = text
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0 && line.includes(":"));

	if (proxies.length === 0) {
		throw new Error("Proxy list returned empty");
	}

	return proxies;
}

export function buildProxyOptions(proxyList: string[]): ProxyOptions[] {
	return proxyList.map((proxy) => ({
		server: `http://${proxy}`,
	}));
}

/**
 * Returns the last known-good proxy for the given domainProject from Redis, or null if none is stored.
 */
export async function getStickyProxy(
	redis: Redis,
	domainProjectId: string,
): Promise<ProxyOptions | null> {
	const raw = await redis.get(stickyKey(domainProjectId));
	if (!raw) return null;
	try {
		return JSON.parse(raw) as ProxyOptions;
	} catch {
		return null;
	}
}

/**
 * Persists a proxy as the last known-good proxy for the given domainProject in Redis with a 30-minute TTL.
 */
export async function setStickyProxy(
	redis: Redis,
	domainProjectId: string,
	proxy: ProxyOptions,
): Promise<void> {
	await redis.set(
		stickyKey(domainProjectId),
		JSON.stringify(proxy),
		"EX",
		STICKY_PROXY_TTL_SECONDS,
	);
}

/**
 * Clears the sticky proxy for the given domainProject (call on crawl failure so next job fetches a fresh list).
 */
export async function clearStickyProxy(
	redis: Redis,
	domainProjectId: string,
): Promise<void> {
	await redis.del(stickyKey(domainProjectId));
}
