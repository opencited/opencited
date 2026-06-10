import * as fs from "node:fs";
import * as path from "node:path";
import { getClipboard, waitFor } from "../actions";
import type { BrowserSession } from "../types";
import type { CrawlerProvider } from "./base";
import type {
	CitationSource,
	CrawlResult,
	StructuredCrawlData,
	AnswerFormat,
} from "./types";
import type { Logger } from "@opencited/logger";
import { defaultLogger } from "@opencited/logger";
import { toMarkdown } from "./turndown";

const DEBUG_DIR = path.join(process.cwd(), "debug");
const BUILD_TIMESTAMP = "2026-05-31T14:00:00Z";

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
	private logger: Logger;

	constructor(logger?: Logger) {
		this.logger = logger ?? defaultLogger;
		this.logger.info(`PerplexityProvider loaded (build: ${BUILD_TIMESTAMP})`);
	}

	async navigate(session: BrowserSession): Promise<void> {
		this.logger.info("Navigating to Perplexity homepage...");
		await session.page.goto("https://www.perplexity.ai/", {
			waitUntil: "load",
		});
		const currentUrl = session.page.url();
		this.logger.info(`Navigation complete. Current URL: ${currentUrl}`);

		const pageTitle = await session.page.title();
		this.logger.info(`Page title: "${pageTitle}"`);

		const bodyTextPreview = await session.page.evaluate(() => {
			const text = document.body?.innerText || "";
			return text.substring(0, 200).replace(/\s+/g, " ").trim();
		});
		this.logger.info(`Page content preview: "${bodyTextPreview}..."`);
	}

	async submitQuery(session: BrowserSession, query: string): Promise<void> {
		this.logger.info(`Submitting query: "${query.substring(0, 50)}..."`);
		await this.waitForCloudflareChallenge(session);

		this.logger.info("Waiting for search input #ask-input...");
		const inputFound = await waitFor(session, "#ask-input", 10000, this.logger);

		if (!inputFound) {
			this.logger.error("Search input #ask-input not found after 10s");
			const currentUrl = session.page.url();
			const pageTitle = await session.page.title();
			this.logger.error(`Current URL: ${currentUrl}`);
			this.logger.error(`Page title: "${pageTitle}"`);

			const availableSelectors = await session.page.evaluate(() => {
				const selectors = [
					"#ask-input",
					"textarea",
					"input[type='text']",
					'[role="textbox"]',
					'[contenteditable="true"]',
					'[class*="input"]',
					'[class*="search"]',
					'[class*="ask"]',
				];
				const results: Record<string, boolean> = {};
				selectors.forEach((sel) => {
					results[sel] = !!document.querySelector(sel);
				});
				return results;
			});
			this.logger.error(
				"Available input selectors:",
				JSON.stringify(availableSelectors),
			);

			const pageContent = await session.page.evaluate(() =>
				document.body.getHTML(),
			);
			const filePath = writeDebugFile("input-not-found", pageContent);
			this.logger.error(`Page content written to: ${filePath}`);

			throw new Error(
				`Search input #ask-input not found. URL: ${currentUrl}, Title: "${pageTitle}"`,
			);
		}

		this.logger.info("Search input found, filling query...");
		await session.page.fill("#ask-input", query);
		this.logger.info("Pressing Enter to submit...");
		await session.page.keyboard.press("Enter");

		await session.page.waitForTimeout(1000);
		const postSubmitUrl = session.page.url();
		this.logger.info(`Post-submit URL: ${postSubmitUrl}`);
	}

	async waitForResponse(session: BrowserSession): Promise<void> {
		await session.page.waitForLoadState("domcontentloaded");
		await this.waitForCloudflareChallenge(session);

		this.logger.info("Waiting for Perplexity response to finish streaming...");
		const maxWait = 60000;
		const pollInterval = 300;
		let elapsed = 0;
		let seenContent = false;
		let lastContentLength = 0;
		let stableSince = 0;

		while (elapsed < maxWait) {
			const state = await session.page.evaluate(() => {
				const stopButton = document.querySelector(
					'button[aria-label*="Stop" i], button[aria-label*="stop" i]',
				);
				const isStreaming = !!stopButton;

				const contentEl = document.querySelector(
					'div[id^="markdown-content-"] .prose, [id^="markdown-content-"]',
				);
				const contentLength = contentEl?.textContent?.length ?? 0;

				return { isStreaming, contentLength };
			});

			if (state.contentLength > 0) {
				seenContent = true;
			}

			if (state.contentLength !== lastContentLength) {
				lastContentLength = state.contentLength;
				stableSince = elapsed;
			}

			const stableFor = elapsed - stableSince;

			if (!state.isStreaming && seenContent && stableFor >= 2000) {
				this.logger.info(
					`Response finished (content: ${state.contentLength} chars, stable for ${stableFor}ms)`,
				);
				return;
			}

			if (state.isStreaming) {
				if (elapsed % 5000 < pollInterval) {
					this.logger.info(
						`Still streaming... (${elapsed / 1000}s, content: ${state.contentLength} chars)`,
					);
				}
			}

			await session.page.waitForTimeout(pollInterval);
			elapsed += pollInterval;
		}

		this.logger.info(
			`Response wait timed out at ${elapsed / 1000}s (content: ${lastContentLength} chars)`,
		);
	}

	private async waitForCloudflareChallenge(
		session: BrowserSession,
	): Promise<void> {
		this.logger.info("Checking for Cloudflare challenge...");
		const maxWait = 15000;
		const interval = 1000;
		let elapsed = 0;

		while (elapsed < maxWait) {
			const hasChallenge = await session.page.evaluate(() => {
				const bodyText = (document.body?.innerText || "")
					.replace(/\s+/g, " ")
					.trim();
				const title = (document.title || "").trim();

				return (
					bodyText.includes("Checking your connection") ||
					bodyText.includes("Verifying you are human") ||
					bodyText.includes("turnstile") ||
					bodyText.includes("captcha") ||
					bodyText.includes("recaptcha") ||
					bodyText.includes("our systems have detected unusual traffic") ||
					/challenge/i.test(title) ||
					!!document.querySelector('iframe[src*="challenges"]') ||
					!!document.querySelector("form#captcha-form") ||
					!!document.querySelector('iframe[src*="recaptcha"]')
				);
			});

			if (!hasChallenge) {
				this.logger.info("No Cloudflare challenge detected");
				return;
			}

			this.logger.info(
				`Cloudflare challenge detected, waiting... (${elapsed / 1000}s)`,
			);
			await session.page.waitForTimeout(interval);
			elapsed += interval;
		}

		throw new Error("Cloudflare challenge timeout - rotating proxy");
	}

	async extractResult(session: BrowserSession): Promise<CrawlResult> {
		const startTime = Date.now();

		const currentUrl = session.page.url();
		const pageTitle = await session.page.title();
		this.logger.info(`Extracting from URL: ${currentUrl}`);
		this.logger.info(`Page title: "${pageTitle}"`);

		await this.waitForCloudflareChallenge(session);

		const pageState = await session.page.evaluate(() => {
			const bodyText = document.body?.innerText || "";
			const hasAskInput = !!document.querySelector("#ask-input");
			const hasCopyButton = !!document.querySelector(
				'button[aria-label="Copy"]',
			);
			const hasProse = !!document.querySelector(
				'[class*="prose"], [class*="answer"]',
			);
			const hasLoading = /loading|generating|thinking|searching/i.test(
				bodyText,
			);
			const hasLoginWall = /sign up and repeat your request/i.test(bodyText);
			const textPreview = bodyText
				.substring(0, 300)
				.replace(/\s+/g, " ")
				.trim();

			return {
				hasAskInput,
				hasCopyButton,
				hasProse,
				hasLoading,
				hasLoginWall,
				textPreview,
				elementCount: document.querySelectorAll("*").length,
			};
		});
		this.logger.info(
			"Page state before extraction:",
			JSON.stringify(pageState, null, 2),
		);

		if (pageState.hasLoginWall) {
			this.logger.info(
				"Login wall detected - Perplexity requires sign-in to view answer",
			);
			throw new Error(
				"Login wall detected - Perplexity requires sign-in to view answer",
			);
		}

		if (pageState.hasLoading) {
			this.logger.info("Page appears to be loading/generating, waiting 5s...");
			await session.page.waitForTimeout(5000);
		}

		this.logger.info("Locating copy button...");
		const copyButtonLocated = await waitFor(
			session,
			'button[aria-label="Copy"]',
			40000,
			this.logger,
		);
		this.logger.info(`Copy button located: ${copyButtonLocated}`);

		let content: string;

		if (copyButtonLocated) {
			this.logger.info("Attempting to click copy button...");

			const buttonState = await session.page.evaluate(() => {
				const btn = document.querySelector('button[aria-label="Copy"]');
				if (!btn) return { found: false };
				const rect = btn.getBoundingClientRect();
				const styles = window.getComputedStyle(btn);
				const parent = btn.parentElement;
				return {
					found: true,
					visible: rect.width > 0 && rect.height > 0,
					display: styles.display,
					visibility: styles.visibility,
					opacity: styles.opacity,
					dataState: btn.getAttribute("data-state"),
					ariaDisabled: btn.getAttribute("aria-disabled"),
					classes: btn.className,
					parentTag: parent?.tagName,
					parentClasses: parent?.className,
				};
			});
			this.logger.info(
				"Copy button state:",
				JSON.stringify(buttonState, null, 2),
			);

			let clicked = false;

			clicked = await session.page.evaluate(() => {
				const btn = document.querySelector('button[aria-label="Copy"]');
				if (btn) {
					(btn as HTMLElement).click();
					return true;
				}
				return false;
			});
			this.logger.info(`JS click result: ${clicked}`);

			this.logger.info(`Copy button clicked: ${clicked}`);
			if (clicked) {
				await session.page.waitForTimeout(1000);
				this.logger.info("Attempting to read from clipboard...");
				content = await getClipboard(session, this.logger);
				this.logger.info(`Clipboard content retrieved: ${!!content}`);
				this.logger.info(
					`Clipboard content length: ${content?.length || 0} chars`,
				);
				if (!content) {
					this.logger.warn("Clipboard is empty, using DOM extraction");
					const html = await session.page.evaluate(() => {
						const answerEl = document.querySelector(
							'div[id^="markdown-content-"] .prose',
						);
						return answerEl?.getHTML() ?? document.body.getHTML();
					});
					content = toMarkdown(html);
				}
			} else {
				this.logger.info("Click failed, writing page content to debug file...");
				const pageContent = await session.page.evaluate(() =>
					document.body.getHTML(),
				);
				const filePath = writeDebugFile("click-failed", pageContent);
				this.logger.info(`Page content written to: ${filePath}`);
				try {
					this.logger.info("Attempting to read from clipboard as fallback...");
					content = await getClipboard(session, this.logger);
					this.logger.info(
						`Clipboard content retrieved in fallback: ${!!content}`,
					);
				} catch {
					this.logger.warn("Clipboard also failed, using DOM extraction");
					const html = await session.page.evaluate(() => {
						const answerEl = document.querySelector(
							'div[id^="markdown-content-"] .prose',
						);
						return answerEl?.getHTML() ?? document.body.getHTML();
					});
					content = toMarkdown(html);
				}
			}
		} else {
			this.logger.info("Copy button not found after 40s wait");
			const pageSummary = await session.page.evaluate(() => {
				const bodyText = document.body?.innerText || "";
				const buttons = Array.from(document.querySelectorAll("button")).map(
					(btn) => ({
						label:
							btn.getAttribute("aria-label") ||
							btn.textContent?.trim().substring(0, 30),
						classes: btn.className.substring(0, 50),
					}),
				);
				const links = Array.from(document.querySelectorAll("a[href]"))
					.slice(0, 10)
					.map((a) => ({
						href: (a as HTMLAnchorElement).href,
						text: a.textContent?.trim().substring(0, 30),
					}));

				return {
					url: window.location.href,
					title: document.title,
					buttonCount: buttons.length,
					buttons: buttons.slice(0, 10),
					linkCount: links.length,
					links,
					bodyTextPreview: bodyText
						.substring(0, 500)
						.replace(/\s+/g, " ")
						.trim(),
				};
			});
			this.logger.info("Page summary:", JSON.stringify(pageSummary, null, 2));

			const lateLoginWall = await session.page.evaluate(() => {
				const bodyText = document.body?.innerText || "";
				return /sign up and repeat your request/i.test(bodyText);
			});

			if (lateLoginWall) {
				this.logger.info(
					"Late login wall detected — throwing AuthenticationError",
				);
				throw new Error(
					"Login wall detected - Perplexity requires sign-in to view answer",
				);
			}

			this.logger.info(
				"No login wall detected, proceeding with clipboard fallback",
			);

			const pageContent = await session.page.evaluate(() =>
				document.body.getHTML(),
			);
			this.logger.info(`Page HTML length: ${pageContent.length} chars`);
			const filePath = writeDebugFile("button-not-found", pageContent);
			this.logger.info(`Page content written to: ${filePath}`);
			try {
				this.logger.info("Attempting clipboard as fallback...");
				const clipboardContent = await getClipboard(session, this.logger);
				this.logger.info(
					`Clipboard content retrieved: ${!!clipboardContent} (length: ${clipboardContent?.length ?? 0} chars)`,
				);
				if (clipboardContent) {
					this.logger.info(
						`Clipboard preview: "${clipboardContent.substring(0, 100)}"`,
					);
					content = clipboardContent;
				} else {
					const html = await session.page.evaluate(() => {
						const answerEl = document.querySelector(
							'div[id^="markdown-content-"] .prose',
						);
						return answerEl?.getHTML() ?? document.body.getHTML();
					});
					content = toMarkdown(html);
				}
			} catch (error) {
				this.logger.warn("Clipboard also failed, using DOM extraction", error);
				const html = await session.page.evaluate(() => {
					const answerEl = document.querySelector(
						'div[id^="markdown-content-"] .prose',
					);
					return answerEl?.getHTML() ?? document.body.getHTML();
				});
				content = toMarkdown(html);
				this.logger.info(
					`Using DOM extraction (length: ${content.length} chars)`,
				);
			}
		}

		const structured = await this.extractStructuredData(session);

		const loadTimeMs = Date.now() - startTime;
		this.logger.info(`Extraction complete in ${loadTimeMs}ms`);
		this.logger.info(`Content length: ${content.length} chars`);
		this.logger.info(`Content preview: "${content.substring(0, 150)}"`);
		this.logger.info(`Citations: ${structured.citations.length}`);
		this.logger.info(
			`Related questions: ${structured.relatedQuestions?.length ?? 0}`,
		);

		const isLikelyLoginWall = /sign up and repeat your request/i.test(content);
		const isTooShort = content.length < 50;
		if (isLikelyLoginWall) {
			this.logger.info("Content appears to be a login wall message — throwing");
			throw new Error(
				"Login wall detected in extracted content - Perplexity requires sign-in",
			);
		}
		if (isTooShort) {
			this.logger.info(
				`Content too short (${content.length} chars) — likely extraction failure`,
			);
			throw new Error(
				`Extraction failed: content too short (${content.length} chars). Page may require authentication.`,
			);
		}

		return {
			provider: this.name,
			query: "",
			content,
			metadata: {
				url: session.page.url(),
				title: await session.page.title(),
				timestamp: new Date(),
				loadTimeMs,
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
