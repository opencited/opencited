import { detectBrandMention } from "./detectBrandMention";

export function citationUrlsFromCrawl(structured?: {
	inlineLinks?: Array<{ url: string }>;
	sourcePanelLinks?: Array<{ url: string }>;
}): string[] {
	const urls: string[] = [];
	for (const link of structured?.inlineLinks ?? []) {
		urls.push(link.url);
	}
	for (const link of structured?.sourcePanelLinks ?? []) {
		urls.push(link.url);
	}
	return urls.filter((url) => {
		try {
			new URL(url);
			return true;
		} catch {
			return false;
		}
	});
}

export function probeRowFromCrawl(params: {
	domain: string;
	brandName: string | null;
	query: string;
	answer: string;
	citationUrls: string[];
}) {
	const detection = detectBrandMention({
		domain: params.domain,
		brandName: params.brandName,
		answer: params.answer,
		citationUrls: params.citationUrls,
	});
	return {
		query: params.query,
		visibility: detection.visibility,
		excerpt: detection.excerpt,
		citationUrls: params.citationUrls.slice(0, 3),
	};
}
