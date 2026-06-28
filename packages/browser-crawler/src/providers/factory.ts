import type { Logger } from "@opencited/logger";
import { PerplexityProvider } from "./perplexity";
import { ChatGPTProvider } from "./chatgpt";
import type { CrawlerProvider } from "./base";

export const providerRegistry: Record<
	string,
	new (
		logger?: Logger,
	) => CrawlerProvider
> = {
	perplexity: PerplexityProvider,
	chatgpt: ChatGPTProvider,
};

export function createProvider(name: string, logger?: Logger): CrawlerProvider {
	const Provider = providerRegistry[name];
	if (!Provider) {
		throw new Error(
			`Unknown crawler provider: "${name}". Registered providers: ${Object.keys(providerRegistry).join(", ")}`,
		);
	}
	return new Provider(logger);
}
