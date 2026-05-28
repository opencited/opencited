import type { Redis } from "ioredis";
import type { ProxyOptions } from "@opencited/browser-crawler";

const STICKY_PROXY_KEY = "proxy:sticky";
const STICKY_PROXY_TTL_SECONDS = 30 * 60; // 30 minutes

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
 * Returns the last known-good proxy from Redis, or null if none is stored.
 */
export async function getStickyProxy(
	redis: Redis,
): Promise<ProxyOptions | null> {
	const raw = await redis.get(STICKY_PROXY_KEY);
	if (!raw) return null;
	try {
		return JSON.parse(raw) as ProxyOptions;
	} catch {
		return null;
	}
}

/**
 * Persists a proxy as the last known-good proxy in Redis with a 30-minute TTL.
 */
export async function setStickyProxy(
	redis: Redis,
	proxy: ProxyOptions,
): Promise<void> {
	await redis.set(
		STICKY_PROXY_KEY,
		JSON.stringify(proxy),
		"EX",
		STICKY_PROXY_TTL_SECONDS,
	);
}

/**
 * Clears the sticky proxy (call on crawl failure so next job fetches a fresh list).
 */
export async function clearStickyProxy(redis: Redis): Promise<void> {
	await redis.del(STICKY_PROXY_KEY);
}
