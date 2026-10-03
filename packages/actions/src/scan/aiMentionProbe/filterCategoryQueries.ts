import { queryMentionsBrandOrDomain } from "./brandQueryTokens";

export function filterCategoryQueries(
	queries: string[],
	params: { brandName: string | null; domain: string },
): string[] {
	return queries.filter((query) => {
		if (!query.trim()) return false;
		return !queryMentionsBrandOrDomain(query, params);
	});
}
