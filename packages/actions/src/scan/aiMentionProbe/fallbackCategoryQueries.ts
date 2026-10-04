import type { HomepageSnapshot } from "./types";
import { brandQueryTokens } from "./brandQueryTokens";

function normalizeTopic(text: string): string {
	return text.replace(/\s+/g, " ").trim();
}

function stripBrandFromTopic(
	text: string,
	brandName: string | null,
	domain: string,
): string {
	let topic = text;
	for (const token of brandQueryTokens(brandName, domain)) {
		topic = topic.replace(new RegExp(token, "gi"), " ");
	}
	return normalizeTopic(topic);
}

function topicFromSnapshot(
	snapshot: HomepageSnapshot,
	brandName: string | null,
	domain: string,
): string {
	const candidates = [
		snapshot.metaDescription?.split(/[.!?]/)[0]?.trim(),
		snapshot.h1?.replace(/\s+/g, " ").trim(),
		snapshot.title?.split("|")[0]?.trim(),
	];
	for (const candidate of candidates) {
		if (!candidate || candidate.length < 8) continue;
		const cleaned = stripBrandFromTopic(
			candidate.slice(0, 100),
			brandName,
			domain,
		);
		if (cleaned.length >= 8) {
			return cleaned;
		}
	}
	return "conversational form builder";
}

function displayBrandName(snapshot: HomepageSnapshot): string | null {
	return snapshot.brandName ?? snapshot.title?.split("|")[0]?.trim() ?? null;
}

/** Used when LLM query derivation fails so the browser probe can still run. */
export function fallbackCategoryQueries(
	snapshot: HomepageSnapshot,
	domain: string,
): string[] {
	const brandName = displayBrandName(snapshot);
	const topic = topicFromSnapshot(snapshot, brandName, domain);
	return [
		`What are the best ${topic} tools?`,
		`How do I choose a ${topic} platform?`,
		`What do experts recommend for ${topic}?`,
	];
}
