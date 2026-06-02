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
		console.log("🧭 Navigating to Perplexity homepage...");
		await session.page.goto("https://www.perplexity.ai/", {
			waitUntil: "networkidle",
		});
		const currentUrl = session.page.url();
		console.log(`✅ Navigation complete. Current URL: ${currentUrl}`);

		// Debug: Check what's on the page after navigation
		const pageTitle = await session.page.title();
		console.log(`📄 Page title: "${pageTitle}"`);

		const bodyTextPreview = await session.page.evaluate(() => {
			const text = document.body?.innerText || "";
			return text.substring(0, 200).replace(/\s+/g, " ").trim();
		});
		console.log(`📝 Page content preview: "${bodyTextPreview}..."`);
	}

	async submitQuery(session: BrowserSession, query: string): Promise<void> {
		console.log(`🔍 Submitting query: "${query.substring(0, 50)}..."`);
		await this.waitForCloudflareChallenge(session);

		console.log("⏳ Waiting for search input #ask-input...");
		const inputFound = await waitFor(session, "#ask-input", 10000);

		if (!inputFound) {
			console.error("❌ Search input #ask-input not found after 10s");
			const currentUrl = session.page.url();
			const pageTitle = await session.page.title();
			console.error(`📍 Current URL: ${currentUrl}`);
			console.error(`📄 Page title: "${pageTitle}"`);

			// Debug: Check what selectors exist on the page
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
			console.error(
				"🔎 Available input selectors:",
				JSON.stringify(availableSelectors),
			);

			// Write debug HTML for analysis
			const pageContent = await session.page.evaluate(() =>
				document.body.getHTML(),
			);
			const filePath = writeDebugFile("input-not-found", pageContent);
			console.error(`📁 Page content written to: ${filePath}`);

			throw new Error(
				`Search input #ask-input not found. URL: ${currentUrl}, Title: "${pageTitle}"`,
			);
		}

		console.log("✅ Search input found, filling query...");
		await session.page.fill("#ask-input", query);
		console.log("⌨️  Pressing Enter to submit...");
		await session.page.keyboard.press("Enter");

		// Debug: Verify navigation after submission
		await session.page.waitForTimeout(1000);
		const postSubmitUrl = session.page.url();
		console.log(`📍 Post-submit URL: ${postSubmitUrl}`);
	}

	async waitForResponse(session: BrowserSession): Promise<void> {
		await session.page.waitForLoadState("networkidle");
		await this.waitForCloudflareChallenge(session);

		console.log("⏳ Waiting for Perplexity response to finish streaming...");
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
				console.log(
					`✅ Response finished (content: ${state.contentLength} chars, stable for ${stableFor}ms)`,
				);
				return;
			}

			if (state.isStreaming) {
				if (elapsed % 5000 < pollInterval) {
					console.log(
						`⏳ Still streaming... (${elapsed / 1000}s, content: ${state.contentLength} chars)`,
					);
				}
			}

			await session.page.waitForTimeout(pollInterval);
			elapsed += pollInterval;
		}

		console.log(
			`⚠️  Response wait timed out at ${elapsed / 1000}s (content: ${lastContentLength} chars)`,
		);
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

		// Debug: Log page state before extraction
		const currentUrl = session.page.url();
		const pageTitle = await session.page.title();
		console.log(`📍 Extracting from URL: ${currentUrl}`);
		console.log(`📄 Page title: "${pageTitle}"`);

		await this.waitForCloudflareChallenge(session);

		// Debug: Check if page has answer content before looking for copy button
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
		console.log(
			"🔍 Page state before extraction:",
			JSON.stringify(pageState, null, 2),
		);

		if (pageState.hasLoginWall) {
			console.log(
				"Login wall detected - Perplexity requires sign-in to view answer",
			);
			throw new Error(
				"Login wall detected - Perplexity requires sign-in to view answer",
			);
		}

		if (pageState.hasLoading) {
			console.log("⏳ Page appears to be loading/generating, waiting 5s...");
			await session.page.waitForTimeout(5000);
		}

		console.log("📋 Locating copy button...");
		const copyButtonLocated = await waitFor(
			session,
			'button[aria-label="Copy"]',
			40000,
		);
		console.log("✅ Copy button located:", copyButtonLocated);

		let content: string;

		if (copyButtonLocated) {
			console.log("🖱️  Attempting to click copy button...");

			// Debug: Check button state before clicking
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
			console.log(
				"🔘 Copy button state:",
				JSON.stringify(buttonState, null, 2),
			);

			let clicked = false;

			// Try JS click first (more reliable for React apps)
			clicked = await session.page.evaluate(() => {
				const btn = document.querySelector('button[aria-label="Copy"]');
				if (btn) {
					(btn as HTMLElement).click();
					return true;
				}
				return false;
			});
			console.log("✅ JS click result:", clicked);

			console.log("📋 Copy button clicked:", clicked);
			if (clicked) {
				await session.page.waitForTimeout(1000);
				console.log("📖 Attempting to read from clipboard...");
				content = await getClipboard(session);
				console.log("📖 Clipboard content retrieved:", !!content);
				console.log(
					`📊 Clipboard content length: ${content?.length || 0} chars`,
				);
				if (!content) {
					console.error("⚠️  Clipboard is empty, using DOM extraction");
					content = await session.page.evaluate(() => document.body.getHTML());
				}
			} else {
				console.log("❌ Click failed, writing page content to debug file...");
				const pageContent = await session.page.evaluate(() =>
					document.body.getHTML(),
				);
				const filePath = writeDebugFile("click-failed", pageContent);
				console.log(`📁 Page content written to: ${filePath}`);
				try {
					console.log("📖 Attempting to read from clipboard as fallback...");
					content = await getClipboard(session);
					console.log("📖 Clipboard content retrieved in fallback:", !!content);
				} catch {
					console.error("⚠️  Clipboard also failed, using DOM extraction");
					content = pageContent;
				}
			}
		} else {
			console.log("❌ Copy button not found after 40s wait");
			// Debug: Log what's on the page
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
			console.log("🔍 Page summary:", JSON.stringify(pageSummary, null, 2));

			// Check for login wall that appeared during the copy button wait
			const lateLoginWall = await session.page.evaluate(() => {
				const bodyText = document.body?.innerText || "";
				return /sign up and repeat your request/i.test(bodyText);
			});

			if (lateLoginWall) {
				console.log(
					"🚫 Late login wall detected — throwing AuthenticationError",
				);
				throw new Error(
					"Login wall detected - Perplexity requires sign-in to view answer",
				);
			}

			console.log(
				"✅ No login wall detected, proceeding with clipboard fallback",
			);

			const pageContent = await session.page.evaluate(() =>
				document.body.getHTML(),
			);
			console.log(`📄 Page HTML length: ${pageContent.length} chars`);
			const filePath = writeDebugFile("button-not-found", pageContent);
			console.log(`📁 Page content written to: ${filePath}`);
			try {
				console.log("📖 Attempting clipboard as fallback...");
				content = await getClipboard(session);
				console.log(
					`📖 Clipboard content retrieved: ${!!content} (length: ${content?.length ?? 0} chars)`,
				);
				if (content) {
					console.log(`📋 Clipboard preview: "${content.substring(0, 100)}"`);
				}
			} catch (error) {
				console.error("⚠️  Clipboard also failed, using DOM extraction", error);
				content = pageContent;
				console.log(
					`📄 Using DOM extraction (length: ${content.length} chars)`,
				);
			}
		}

		const structured = await this.extractStructuredData(session);

		const loadTimeMs = Date.now() - startTime;
		console.log(`✅ Extraction complete in ${loadTimeMs}ms`);
		console.log(`📊 Content length: ${content.length} chars`);
		console.log(`📊 Content preview: "${content.substring(0, 150)}"`);
		console.log(`📊 Citations: ${structured.citations.length}`);
		console.log(
			`📊 Related questions: ${structured.relatedQuestions?.length ?? 0}`,
		);

		// Validate content quality before returning
		const isLikelyLoginWall = /sign up and repeat your request/i.test(content);
		const isTooShort = content.length < 50;
		if (isLikelyLoginWall) {
			console.log("⚠️  Content appears to be a login wall message — throwing");
			throw new Error(
				"Login wall detected in extracted content - Perplexity requires sign-in",
			);
		}
		if (isTooShort) {
			console.log(
				`⚠️  Content too short (${content.length} chars) — likely extraction failure`,
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
