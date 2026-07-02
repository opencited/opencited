import type { Redis } from "ioredis";
import type { Logger as CrawlerLogger } from "@opencited/logger";
import type { ProxyOptions } from "@opencited/browser-crawler";
import { getProxyConfigByDomainProjectIdAction } from "@opencited/actions";
import type { Context } from "@opencited/actions";
import { env } from "../env";

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

function buildProxyOptions(proxyList: string[]): ProxyOptions[] {
	return proxyList.map((proxy) => ({
		server: `http://${proxy}`,
	}));
}

function parseBatchProxyList(raw: string): string[] {
	return raw
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0 && line.includes(":"));
}

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

export async function clearStickyProxy(
	redis: Redis,
	domainProjectId: string,
): Promise<void> {
	await redis.del(stickyKey(domainProjectId));
}

interface ProxyConfig {
	id: string;
	domainProjectId: string;
	enabled: boolean;
	sourceType: "api" | "batch";
	sourceValue: string;
	stickyProxyEnabled: boolean;
}

async function resolveCustomProxyApi(
	config: ProxyConfig,
	domainProjectId: string,
	redis: Redis,
	logger: CrawlerLogger,
): Promise<{ proxies: ProxyOptions[]; usedSticky: boolean }> {
	if (config.stickyProxyEnabled) {
		const stickyProxy = await getStickyProxy(redis, domainProjectId);
		if (stickyProxy) {
			logger.info("Using sticky proxy from last successful crawl", {
				server: stickyProxy.server,
			});
			return { proxies: [stickyProxy], usedSticky: true };
		}
	}

	const proxyList = await fetchProxyList(config.sourceValue);
	const proxies = buildProxyOptions(proxyList);
	logger.info("Proxy list fetched", {
		proxyCount: proxies.length,
	});
	return { proxies, usedSticky: false };
}

async function resolveCustomProxyBatch(
	config: ProxyConfig,
	domainProjectId: string,
	redis: Redis,
	logger: CrawlerLogger,
): Promise<{ proxies: ProxyOptions[]; usedSticky: boolean }> {
	if (config.stickyProxyEnabled) {
		const stickyProxy = await getStickyProxy(redis, domainProjectId);
		if (stickyProxy) {
			logger.info("Using sticky proxy from last successful crawl", {
				server: stickyProxy.server,
			});
			return { proxies: [stickyProxy], usedSticky: true };
		}
	}

	const proxyList = parseBatchProxyList(config.sourceValue);
	if (proxyList.length > 0) {
		const proxies = buildProxyOptions(proxyList);
		logger.info("Using custom batch proxy list", {
			proxyCount: proxies.length,
		});
		return { proxies, usedSticky: false };
	}

	return { proxies: [], usedSticky: false };
}

async function resolveThorDataProxy(
	domainProjectId: string,
	redis: Redis,
	logger: CrawlerLogger,
): Promise<{ proxies: ProxyOptions[]; usedSticky: boolean }> {
	if (env.STICKY_PROXY_ENABLED) {
		const stickyProxy = await getStickyProxy(redis, domainProjectId);
		if (stickyProxy) {
			logger.info("Using sticky proxy from last successful crawl", {
				server: stickyProxy.server,
			});
			return { proxies: [stickyProxy], usedSticky: true };
		}
	}

	const proxyList = await fetchProxyList(env.THORDATA_PROXY_API_URL!);
	const proxies = buildProxyOptions(proxyList);
	logger.info("Proxy list fetched", {
		proxyCount: proxies.length,
	});
	return { proxies, usedSticky: false };
}

function resolveSingleProxy(): {
	proxies: ProxyOptions[];
	usedSticky: boolean;
} | null {
	if (!env.PROXY_SERVER) {
		return null;
	}

	return {
		proxies: [
			{
				server: env.PROXY_SERVER,
				username: env.PROXY_USERNAME,
				password: env.PROXY_PASSWORD,
			},
		],
		usedSticky: false,
	};
}

export interface ResolveProxiesParams {
	domainProjectId: string;
	ctx: Context;
	redis: Redis;
	logger: CrawlerLogger;
}

export async function resolveProxies({
	domainProjectId,
	ctx,
	redis,
	logger,
}: ResolveProxiesParams): Promise<{
	proxies: ProxyOptions[];
	usedSticky: boolean;
}> {
	const customProxyConfig = await getProxyConfigByDomainProjectIdAction({
		input: { domainProjectId },
		ctx,
	});

	if (customProxyConfig?.enabled) {
		if (customProxyConfig.sourceType === "api") {
			return resolveCustomProxyApi(
				customProxyConfig,
				domainProjectId,
				redis,
				logger,
			);
		}
		return resolveCustomProxyBatch(
			customProxyConfig,
			domainProjectId,
			redis,
			logger,
		);
	}

	if (env.THORDATA_PROXY_API_URL) {
		return resolveThorDataProxy(domainProjectId, redis, logger);
	}

	const single = resolveSingleProxy();
	if (single) {
		return single;
	}

	return { proxies: [], usedSticky: false };
}
