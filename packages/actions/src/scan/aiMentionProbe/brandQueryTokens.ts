export function brandQueryTokens(
	brandName: string | null,
	domain: string,
): string[] {
	const tokens = new Set<string>();
	const domainHost =
		domain
			.toLowerCase()
			.replace(/^https?:\/\//, "")
			.replace(/^www\./, "")
			.split("/")[0] ?? domain;
	if (domainHost) {
		tokens.add(domainHost);
		const label = domainHost.split(".")[0];
		if (label && label.length >= 3) {
			tokens.add(label);
		}
	}
	if (brandName?.trim()) {
		for (const part of brandName.toLowerCase().split(/[|/]+/)) {
			for (const word of part.split(/\s+/)) {
				const token = word.replace(/[^a-z0-9-]/g, "");
				if (token.length >= 3) {
					tokens.add(token);
				}
			}
		}
	}
	return [...tokens];
}

export function queryMentionsBrandOrDomain(
	query: string,
	params: { brandName: string | null; domain: string },
): boolean {
	const lower = query.toLowerCase();
	for (const token of brandQueryTokens(params.brandName, params.domain)) {
		if (lower.includes(token)) {
			return true;
		}
	}
	return false;
}
