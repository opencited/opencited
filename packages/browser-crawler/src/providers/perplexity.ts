import type { BrowserSession } from "../types";
import type { CrawlResult } from "./types";
import type { CrawlerProvider } from "./base";
import { waitFor, click, getClipboard } from "../actions";
import { ExtractionError } from "../errors";

export class PerplexityProvider implements CrawlerProvider {
	readonly name = "perplexity";
	readonly requiresAuth = false;

	async navigate(session: BrowserSession): Promise<void> {
		await session.page.goto("https://www.perplexity.ai/", {
			waitUntil: "networkidle",
		});
	}

	async submitQuery(session: BrowserSession, query: string): Promise<void> {
		await waitFor(session, "#ask-input", 10000);
		await session.page.fill("#ask-input", query);
		await session.page.keyboard.press("Enter");
	}

	async waitForResponse(session: BrowserSession): Promise<void> {
		await session.page.waitForLoadState("networkidle");
		await session.page.waitForTimeout(3000);
	}

	async extractResult(session: BrowserSession): Promise<CrawlResult> {
		const startTime = Date.now();

		const copyButtonLocated = await waitFor(
			session,
			'button[aria-label="Copy"]',
			15000,
		);

		if (!copyButtonLocated) {
			throw new ExtractionError(
				this.name,
				new Error("Copy button not found - Perplexity UI may have changed"),
			);
		}

		await click(session, 'button[aria-label="Copy"]');
		await session.page.waitForTimeout(1000);

		const clipboardContent = await getClipboard(session);

		return {
			provider: this.name,
			query: "",
			content: clipboardContent,
			metadata: {
				url: session.page.url(),
				title: await session.page.title(),
				timestamp: new Date(),
				loadTimeMs: Date.now() - startTime,
			},
		};
	}
}
