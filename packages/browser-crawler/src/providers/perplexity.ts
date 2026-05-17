import type { BrowserSession } from "../types";
import type {
	CrawlResult,
	StructuredCrawlData,
	CitationSource,
	AnswerFormat,
} from "./types";
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
			60000,
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

		const structured = await this.extractStructuredData(session);

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
			structured,
		};
	}

	private async extractStructuredData(
		session: BrowserSession,
	): Promise<StructuredCrawlData> {
		const citations = await this.extractCitations(session);
		const relatedQuestions = await this.extractRelatedQuestions(session);
		const answerFormat = this.detectAnswerFormat(session);

		return {
			citations,
			brandMentions: [],
			relatedQuestions,
			answerFormat,
		};
	}

	private async extractCitations(
		session: BrowserSession,
	): Promise<CitationSource[]> {
		const citations: CitationSource[] = [];

		try {
			const externalLinks = await session.page.evaluate(() => {
				const links: Array<{
					href: string;
					text: string;
					hasCitation: boolean;
				}> = [];

				const answerContainer = document.querySelector(
					'[class*="prose"], [class*="answer"]',
				);
				if (!answerContainer) return links;

				const allLinks = answerContainer.querySelectorAll("a[href]");
				allLinks.forEach((link) => {
					const href = (link as HTMLAnchorElement).href;
					if (href && (href.startsWith("http") || href.startsWith("https"))) {
						const parent = link.closest(".citation, [class*='citation']");
						links.push({
							href,
							text: link.textContent?.trim() ?? "",
							hasCitation: !!parent,
						});
					}
				});

				return links;
			});

			const seen = new Set<string>();
			let position = 1;

			for (const link of externalLinks) {
				if (seen.has(link.href)) continue;
				seen.add(link.href);

				const url = new URL(link.href);
				const domain = url.hostname.replace("www.", "");

				citations.push({
					domain,
					url: link.href,
					position: position++,
					sourceName: link.text.split(/\s+/)[0]?.toLowerCase() ?? domain,
				});
			}
		} catch {
			// Citations extraction is non-critical
		}

		return citations;
	}

	private async extractRelatedQuestions(
		session: BrowserSession,
	): Promise<string[]> {
		const questions: string[] = [];

		try {
			const relatedQuestions = await session.page.evaluate(() => {
				const buttons = Array.from(
					document.querySelectorAll('button[class*="interactable"]'),
				);
				return buttons
					.map((btn) => btn.textContent?.trim() ?? "")
					.filter(
						(text) =>
							text.length > 20 &&
							(text.endsWith("?") ||
								text.startsWith("How") ||
								text.startsWith("What") ||
								text.startsWith("Why") ||
								text.startsWith("Which")),
					);
			});

			questions.push(...relatedQuestions);
		} catch {
			// Related questions extraction is non-critical
		}

		return questions;
	}

	private detectAnswerFormat(_session: BrowserSession): AnswerFormat {
		return "unknown";
	}
}
