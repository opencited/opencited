import type { BrowserSession } from "../types";
import { type, press, waitFor, extractContent } from "../actions";

export interface PerplexityOptions {
	query: string;
	waitForResponse?: boolean;
	extractSources?: boolean;
}

export async function runPerplexityQuery(
	session: BrowserSession,
	options: PerplexityOptions,
): Promise<void> {
	const { query, waitForResponse = true, extractSources = true } = options;

	console.log("🔍 Running Perplexity query...");

	await waitFor(session, 'textarea[placeholder*="Ask"]', 10000);

	await type(session, 'textarea[placeholder*="Ask"]', query);

	console.log("⏳ Waiting for response...");
	await press(session, "Enter");

	if (waitForResponse) {
		await waitFor(session, '[class*="response"]', 30000);
		await session.page.waitForLoadState("networkidle");
	}

	console.log("✅ Query complete");

	if (extractSources) {
		const content = await extractContent(session, {
			text: true,
			sources: true,
			links: true,
		});

		console.log("\n📊 Extracted Content:");
		console.log(`   Title: ${content.title}`);
		console.log(`   Word count: ${content.metadata.wordCount}`);
		console.log(`   Links: ${content.links?.length ?? 0}`);
		console.log(`   Sources: ${content.sources?.length ?? 0}`);

		if (content.sources && content.sources.length > 0) {
			console.log("\n📚 Sources:");
			content.sources.forEach((source, i) => {
				console.log(`   ${i + 1}. ${source.text}`);
				if (source.url) console.log(`      ${source.url}`);
			});
		}
	}
}
