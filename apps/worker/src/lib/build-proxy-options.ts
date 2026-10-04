import type { ProxyOptions } from "@opencited/browser-crawler";
import { env } from "../env";

/** Host lines from ThorData (or batch lists) → Camoufox proxy options, with optional env auth. */
export function buildProxyOptionsFromList(proxyList: string[]): ProxyOptions[] {
	return proxyList.map((entry) => {
		const server =
			entry.startsWith("http://") || entry.startsWith("https://")
				? entry
				: `http://${entry}`;
		const opts: ProxyOptions = { server };
		if (env.PROXY_USERNAME) {
			opts.username = env.PROXY_USERNAME;
			opts.password = env.PROXY_PASSWORD;
		}
		return opts;
	});
}
