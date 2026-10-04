const MAX_EXCERPT = 320;

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeHost(hostname: string): string {
	return hostname.toLowerCase().replace(/^www\./, "");
}

export function hostMatchesDomain(hostname: string, domain: string): boolean {
	const host = normalizeHost(hostname);
	const target = normalizeHost(domain);
	return host === target || host.endsWith(`.${target}`);
}

function brandMentionedInText(answer: string, brandName: string): boolean {
	const trimmed = brandName.trim();
	if (!trimmed) return false;
	const pattern = new RegExp(`\\b${escapeRegExp(trimmed)}\\b`, "i");
	return pattern.test(answer);
}

function buildExcerpt(answer: string, brandName: string): string {
	const normalized = answer.replace(/\s+/g, " ").trim();
	if (!normalized) return "";
	const pattern = new RegExp(`\\b${escapeRegExp(brandName.trim())}\\b`, "i");
	const match = pattern.exec(normalized);
	if (!match || match.index === undefined) {
		return normalized.slice(0, MAX_EXCERPT);
	}
	const start = Math.max(0, match.index - 80);
	const end = Math.min(normalized.length, match.index + MAX_EXCERPT - 80);
	let excerpt = normalized.slice(start, end);
	if (start > 0) excerpt = `…${excerpt}`;
	if (end < normalized.length) excerpt = `${excerpt}…`;
	return excerpt;
}

export function detectBrandMention(params: {
	domain: string;
	brandName: string | null;
	answer: string;
	citationUrls: string[];
}): { visibility: "visible" | "not-visible"; excerpt: string } {
	const cited = params.citationUrls.some((url) => {
		try {
			return hostMatchesDomain(new URL(url).hostname, params.domain);
		} catch {
			return false;
		}
	});

	const brand = params.brandName?.trim() ?? "";
	const mentioned = brand ? brandMentionedInText(params.answer, brand) : false;
	const visible = cited || mentioned;

	const normalizedAnswer = params.answer.replace(/\s+/g, " ").trim();
	const excerpt =
		mentioned && brand
			? buildExcerpt(params.answer, brand)
			: normalizedAnswer.slice(0, MAX_EXCERPT);

	return {
		visibility: visible ? "visible" : "not-visible",
		excerpt,
	};
}
