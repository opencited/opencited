import type { InlineLink } from "./types";

export const PROVIDER_OWNED_DOMAINS: Record<string, string[]> = {
	chatgpt: ["chatgpt.com", "openai.com"],
	perplexity: ["perplexity.ai"],
};

export function filterSelfCitations(
	provider: string,
	links: InlineLink[],
): InlineLink[] {
	const owned = PROVIDER_OWNED_DOMAINS[provider];
	if (!owned || owned.length === 0) return links;

	const ownedSet = new Set(owned.map((d) => d.toLowerCase()));
	return links.filter((link) => !ownedSet.has(link.domain.toLowerCase()));
}
