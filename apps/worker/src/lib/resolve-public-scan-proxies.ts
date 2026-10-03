import type { ProxyOptions } from "@opencited/browser-crawler";
import { env } from "../env";
import { buildProxyOptionsFromList } from "./build-proxy-options";
import { fetchProxyList } from "./proxy-resolution";

/** ThorData country-entry gateway for IP-whitelist auth (not the get-ip API host list). */
const THORDATA_WHITELIST_GATEWAY = "http://pr.thordata.net:9999";

function singleProxyFromEnv(): ProxyOptions[] {
	return [
		{
			server: env.PROXY_SERVER!,
			username: env.PROXY_USERNAME,
			password: env.PROXY_PASSWORD,
		},
	];
}

function whitelistGatewayProxy(): ProxyOptions[] {
	const server = env.THORDATA_PROXY_GATEWAY ?? THORDATA_WHITELIST_GATEWAY;
	return [
		{
			server,
			username: env.PROXY_USERNAME,
			password: env.PROXY_PASSWORD,
		},
	];
}

export type PublicScanProxySource =
	| "proxy_server"
	| "thordata_gateway"
	| "thordata_api_list"
	| "none";

export async function resolveProxiesForPublicScan(): Promise<ProxyOptions[]> {
	if (env.PROXY_SERVER) {
		return singleProxyFromEnv();
	}

	if (env.THORDATA_PROXY_API_URL) {
		const useApiList =
			env.THORDATA_PROXY_USE_API_LIST ||
			Boolean(env.PROXY_USERNAME && env.PROXY_PASSWORD);
		if (useApiList) {
			const proxyList = await fetchProxyList(env.THORDATA_PROXY_API_URL);
			return buildProxyOptionsFromList(proxyList);
		}
		return whitelistGatewayProxy();
	}

	return [];
}

export function describePublicScanProxySource(): PublicScanProxySource {
	if (env.PROXY_SERVER) {
		return "proxy_server";
	}
	if (env.THORDATA_PROXY_API_URL) {
		const useApiList =
			env.THORDATA_PROXY_USE_API_LIST ||
			Boolean(env.PROXY_USERNAME && env.PROXY_PASSWORD);
		return useApiList ? "thordata_api_list" : "thordata_gateway";
	}
	return "none";
}
