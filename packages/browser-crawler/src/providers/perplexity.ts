import * as fs from "node:fs";
import * as path from "node:path";
import type { BrowserSession } from "../types";
import type {
	CrawlResult,
	StructuredCrawlData,
	CitationSource,
	AnswerFormat,
} from "./types";
import type { CrawlerProvider } from "./base";
import { waitFor, click, getClipboard } from "../actions";

const DEBUG_DIR = path.join(process.cwd(), "debug");
const BUILD_TIMESTAMP = "2026-05-31T14:00:00Z"; // Update this on each deploy

function writeDebugFile(label: string, content: string): string {
	fs.mkdirSync(DEBUG_DIR, { recursive: true });
	const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
	const filename = `perplexity-${label}-${timestamp}.html`;
	const filePath = path.join(DEBUG_DIR, filename);
	fs.writeFileSync(filePath, content, "utf-8");
	return filePath;
}

export class PerplexityProvider implements CrawlerProvider {
	readonly name = "perplexity";
	readonly requiresAuth = false;

	constructor() {
		console.log(`📦 PerplexityProvider loaded (build: ${BUILD_TIMESTAMP})`);
	}

	async navigate(session: BrowserSession): Promise<void> {
		await session.page.goto("https://www.perplexity.ai/", {
			waitUntil: "networkidle",
		});
	}

	async submitQuery(session: BrowserSession, query: string): Promise<void> {
		await this.waitForCloudflareChallenge(session);
		await waitFor(session, "#ask-input", 10000);
		await session.page.fill("#ask-input", query);
		await session.page.keyboard.press("Enter");
	}

	async waitForResponse(session: BrowserSession): Promise<void> {
		await session.page.waitForLoadState("networkidle");
		await this.waitForCloudflareChallenge(session);
		await session.page.waitForTimeout(3000);
	}

	private async waitForCloudflareChallenge(
		session: BrowserSession,
	): Promise<void> {
		console.log("Checking for Cloudflare challenge...");
		const maxWait = 15000;
		const interval = 1000;
		let elapsed = 0;

		while (elapsed < maxWait) {
			const hasChallenge = await session.page.evaluate(() => {
				const html = document.documentElement.innerHTML;
				return (
					html.includes("__CF$cv$params") ||
					html.includes("challenge-platform") ||
					html.includes("Checking your connection") ||
					html.includes("Verifying you are human") ||
					!!document.querySelector('iframe[src*="challenges"]') ||
					!!document.querySelector('iframe[src*="cdn-cgi"]') ||
					!!document.querySelector('[class*="cf-"]') ||
					!!document.querySelector('[id*="cf-"]')
				);
			});

			if (!hasChallenge) {
				console.log("No Cloudflare challenge detected");
				return;
			}

			console.log(
				`Cloudflare challenge detected, waiting... (${elapsed / 1000}s)`,
			);
			await session.page.waitForTimeout(interval);
			elapsed += interval;
		}

		throw new Error("Cloudflare challenge timeout - rotating proxy");
	}

	async extractResult(session: BrowserSession): Promise<CrawlResult> {
		const startTime = Date.now();

		await this.waitForCloudflareChallenge(session);

		console.log("Locating copy button...");
		const copyButtonLocated = await waitFor(
			session,
			'button[aria-label="Copy"]',
			20000,
		);
		console.log("Copy button located:", copyButtonLocated);

		let content: string;

		if (copyButtonLocated) {
			console.log("Attempting to click copy button...");

			// Debug: Check button state before clicking
			const buttonState = await session.page.evaluate(() => {
				const btn = document.querySelector('button[aria-label="Copy"]');
				if (!btn) return { found: false };
				const rect = btn.getBoundingClientRect();
				const styles = window.getComputedStyle(btn);
				return {
					found: true,
					visible: rect.width > 0 && rect.height > 0,
					display: styles.display,
					visibility: styles.visibility,
					opacity: styles.opacity,
					dataState: btn.getAttribute("data-state"),
					classes: btn.className,
				};
			});
			console.log("Copy button state:", JSON.stringify(buttonState));

			let clicked = false;

			// Try Playwright click first
			try {
				clicked = await click(session, 'button[aria-label="Copy"]');
			} catch {
				console.log("Playwright click failed, trying JS click...");
			}

			// Fallback: JavaScript click
			if (!clicked) {
				clicked = await session.page.evaluate(() => {
					const btn = document.querySelector('button[aria-label="Copy"]');
					if (btn) {
						(btn as HTMLElement).click();
						return true;
					}
					return false;
				});
				console.log("JS click result:", clicked);
			}

			console.log("Copy button clicked:", clicked);
			if (clicked) {
				await session.page.waitForTimeout(1000);
				console.log("Attempting to read from clipboard...");
				content = await getClipboard(session);
				console.log("Clipboard content retrieved:", !!content);
				if (!content) {
					console.error("⚠️  Clipboard is empty, using DOM extraction");
					content = await session.page.evaluate(() => document.body.getHTML());
				}
			} else {
				console.log("Click failed, writing page content to debug file...");
				const pageContent = await session.page.evaluate(() =>
					document.body.getHTML(),
				);
				const filePath = writeDebugFile("click-failed", pageContent);
				console.log(`Page content written to: ${filePath}`);
				try {
					console.log("Attempting to read from clipboard as fallback...");
					content = await getClipboard(session);
					console.log("Clipboard content retrieved in fallback:", !!content);
				} catch {
					console.error("⚠️  Clipboard also failed, using DOM extraction");
					content = pageContent;
				}
			}
		} else {
			const pageContent = await session.page.evaluate(() =>
				document.body.getHTML(),
			);
			const filePath = writeDebugFile("button-not-found", pageContent);
			console.log(
				`Copy button not found, page content written to: ${filePath}`,
			);
			try {
				content = await getClipboard(session);
			} catch (error) {
				console.error("⚠️  Clipboard also failed, using DOM extraction", error);
				content = pageContent;
			}
		}

		const structured = await this.extractStructuredData(session);

		return {
			provider: this.name,
			query: "",
			content,
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
