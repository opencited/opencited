import * as fs from "node:fs";
import * as path from "node:path";
import { getClipboard, waitFor } from "../actions";
import type { BrowserSession } from "../types";
import type { CrawlerProvider } from "./base";
import type {
	InlineLink,
	CrawlResult,
	StructuredCrawlData,
	AnswerFormat,
} from "./types";
import type { Logger } from "@opencited/logger";
import { defaultLogger } from "@opencited/logger";
import { toMarkdown } from "./turndown";
import type { FailureType } from "../errors";
import {
	isDuplicatedPerplexityQuery,
	normalizePerplexityQueryText,
	perplexityBodyHasLoginWall,
	PERPLEXITY_ANSWER_SELECTORS,
	PERPLEXITY_ASK_INPUT_CANDIDATE_SELECTORS,
	PERPLEXITY_ENSURE_ASK_INPUT_FN,
	PERPLEXITY_RESPONSE_STATE_FN,
} from "./perplexity-dom";

const DEBUG_DIR = path.join(process.cwd(), "debug");
const BUILD_TIMESTAMP = "2026-05-31T14:00:00Z";
const PERPLEXITY_LOGIN_MODAL_HEADING_RE = /login or sign up/i;
const PERPLEXITY_LOGIN_MODAL_TEXT_RE =
	/login or sign up for free|continue with google|continue with apple|continue with email/i;
const PERPLEXITY_GOOGLE_SIGNIN_RE = /sign in to perplexity with google/i;
const PERPLEXITY_OVERLAY_SELECTOR =
	'[role="dialog"], [aria-modal="true"], [data-radix-popper-content-wrapper]';
const PERPLEXITY_SUBMIT_WAIT_MS = 15_000;
const PERPLEXITY_ASK_INPUT_WAIT_MS = 45_000;

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
			waitUntil: "domcontentloaded",
			timeout: 60_000,
		});
		try {
			await session.page.waitForLoadState("load", { timeout: 30_000 });
		} catch {
			this.logger.warn(
				"Perplexity load event slow; continuing after domcontentloaded",
			);
		}
		const currentUrl = session.page.url();
		this.logger.info(`Navigation complete. Current URL: ${currentUrl}`);

		const pageTitle = await session.page.title();
		this.logger.info(`Page title: "${pageTitle}"`);

		const bodyTextPreview = await session.page.evaluate(() => {
			const text = document.body?.innerText || "";
			return text.substring(0, 200).replace(/\s+/g, " ").trim();
		});
		this.logger.info(`Page content preview: "${bodyTextPreview}..."`);
		await this.dismissPerplexityOverlays(session);
	}

	private async waitForAskInput(session: BrowserSession): Promise<void> {
		this.logger.info("Waiting for Perplexity composer (#ask-input)...");
		const started = Date.now();
		let lastDismiss = 0;
		let lastMatched: string | null = null;

		while (Date.now() - started < PERPLEXITY_ASK_INPUT_WAIT_MS) {
			if (Date.now() - lastDismiss > 2000) {
				await this.dismissPerplexityOverlays(session);
				lastDismiss = Date.now();
			}

			const result = await session.page.evaluate(
				PERPLEXITY_ENSURE_ASK_INPUT_FN,
				[...PERPLEXITY_ASK_INPUT_CANDIDATE_SELECTORS],
			);
			if (result.ok) {
				lastMatched = result.matched;
				break;
			}

			await session.page.waitForTimeout(400);
		}

		if (!lastMatched) {
			throw new Error(
				`Search input #ask-input not found after ${PERPLEXITY_ASK_INPUT_WAIT_MS / 1000}s`,
			);
		}

		this.logger.info(`Perplexity composer ready (matched: ${lastMatched})`);
		await session.page.locator("#ask-input").first().waitFor({
			state: "visible",
			timeout: 5000,
		});
	}

	async submitQuery(session: BrowserSession, query: string): Promise<void> {
		this.logger.info(`Submitting query: "${query.substring(0, 50)}..."`);
		await this.waitForCloudflareChallenge(session);
		await this.dismissPerplexityOverlays(session);

		try {
			await this.waitForAskInput(session);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			if (!message.includes("#ask-input not found")) {
				throw error;
			}
			this.logger.error(
				`Search input #ask-input not found after ${PERPLEXITY_ASK_INPUT_WAIT_MS / 1000}s`,
			);
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

		await this.prepareComposer(session);
		this.logger.info("Search input found, filling query...");
		await this.clearAndFillAskInput(session, query);
		await this.prepareComposer(session);
		this.logger.info("Submitting query to Perplexity...");
		await this.submitAskInput(session, query);

		await this.dismissPerplexityOverlays(session);
		await session.page.waitForTimeout(1500);
		await this.assertNoLoginWall(session, "after query submit");

		const postSubmitUrl = session.page.url();
		this.logger.info(`Post-submit URL: ${postSubmitUrl}`);
	}

	private async assertNoLoginWall(
		session: BrowserSession,
		phase: string,
	): Promise<void> {
		if (await this.hasLoginWall(session)) {
			throw new Error(
				`Login wall detected (${phase}) - Perplexity requires sign-in to view answer`,
			);
		}
	}

	private async hasLoginModal(session: BrowserSession): Promise<boolean> {
		return session.page.evaluate(
			({ overlaySelector, headingRe, textRe }) => {
				const heading = new RegExp(headingRe, "i");
				const body = new RegExp(textRe, "i");
				for (const el of document.querySelectorAll(overlaySelector)) {
					const text = el.textContent ?? "";
					if (heading.test(text) || body.test(text)) {
						return true;
					}
				}
				for (const el of document.querySelectorAll("h1, h2, h3, p, span")) {
					const text = el.textContent?.trim() ?? "";
					if (!heading.test(text)) continue;
					let node: Element | null = el;
					for (let depth = 0; depth < 12 && node; depth++) {
						const style = window.getComputedStyle(node);
						const z = Number.parseInt(style.zIndex || "0", 10);
						if (
							style.position === "fixed" ||
							node.getAttribute("role") === "dialog" ||
							z > 50
						) {
							return true;
						}
						node = node.parentElement;
					}
				}
				return false;
			},
			{
				overlaySelector: PERPLEXITY_OVERLAY_SELECTOR,
				headingRe: PERPLEXITY_LOGIN_MODAL_HEADING_RE.source,
				textRe: PERPLEXITY_LOGIN_MODAL_TEXT_RE.source,
			},
		);
	}

	private async removeLoginModal(session: BrowserSession): Promise<boolean> {
		return session.page.evaluate(
			({ overlaySelector, headingRe, textRe }) => {
				const heading = new RegExp(headingRe, "i");
				const body = new RegExp(textRe, "i");
				let removed = false;

				for (const el of document.querySelectorAll(overlaySelector)) {
					const text = el.textContent ?? "";
					if (heading.test(text) || body.test(text)) {
						el.remove();
						removed = true;
					}
				}

				for (const el of document.querySelectorAll("h1, h2, h3, p, span")) {
					const text = el.textContent?.trim() ?? "";
					if (!heading.test(text)) continue;
					let node: Element | null = el;
					for (let depth = 0; depth < 12 && node; depth++) {
						const style = window.getComputedStyle(node);
						const z = Number.parseInt(style.zIndex || "0", 10);
						if (
							style.position === "fixed" ||
							node.getAttribute("role") === "dialog" ||
							z > 50
						) {
							node.remove();
							removed = true;
							break;
						}
						node = node.parentElement;
					}
				}

				for (const btn of document.querySelectorAll("button")) {
					const label = (btn.getAttribute("aria-label") ?? "").toLowerCase();
					const text = (btn.textContent ?? "").trim();
					if (
						text === "Close" ||
						label === "close" ||
						label.includes("close dialog") ||
						label === "dismiss"
					) {
						(btn as HTMLElement).click();
						removed = true;
					}
				}

				return removed;
			},
			{
				overlaySelector: PERPLEXITY_OVERLAY_SELECTOR,
				headingRe: PERPLEXITY_LOGIN_MODAL_HEADING_RE.source,
				textRe: PERPLEXITY_LOGIN_MODAL_TEXT_RE.source,
			},
		);
	}

	private async dismissCookieBanner(session: BrowserSession): Promise<boolean> {
		return session.page.evaluate(() => {
			let acted = false;
			for (const btn of document.querySelectorAll("button")) {
				const text = (btn.textContent ?? "").trim();
				if (/^(got it|decline optional|accept all)$/i.test(text)) {
					(btn as HTMLElement).click();
					acted = true;
				}
			}
			for (const el of document.querySelectorAll("div, section")) {
				const text = (el.textContent ?? "").slice(0, 200);
				if (!/cookie policy/i.test(text)) continue;
				const rect = el.getBoundingClientRect();
				if (rect.width > 200 && rect.height > 80) {
					el.remove();
					acted = true;
				}
			}
			return acted;
		});
	}

	private async dismissGoogleSignInPrompt(
		session: BrowserSession,
	): Promise<boolean> {
		return session.page.evaluate(
			({ googleRe }) => {
				const re = new RegExp(googleRe, "i");
				let acted = false;

				for (const iframe of document.querySelectorAll("iframe")) {
					const src = iframe.getAttribute("src") ?? "";
					if (/google|accounts\.google/i.test(src)) {
						iframe.remove();
						acted = true;
					}
				}

				const removeOverlayRoot = (start: Element): boolean => {
					let node: Element | null = start;
					for (let depth = 0; depth < 14 && node; depth++) {
						const style = window.getComputedStyle(node);
						const rect = node.getBoundingClientRect();
						if (
							(style.position === "fixed" ||
								style.position === "absolute" ||
								node.getAttribute("role") === "dialog") &&
							rect.width > 100 &&
							rect.height > 60
						) {
							node.remove();
							return true;
						}
						node = node.parentElement;
					}
					start.remove();
					return true;
				};

				for (const el of document.querySelectorAll(
					"div, section, aside, header",
				)) {
					const text = (el.textContent ?? "").trim();
					if (!re.test(text) || text.length > 600) continue;
					if (removeOverlayRoot(el)) acted = true;
				}

				for (const btn of document.querySelectorAll("button")) {
					const label = (btn.getAttribute("aria-label") ?? "").toLowerCase();
					const text = (btn.textContent ?? "").trim();
					const card = btn.closest("div, section, aside");
					const cardText = card?.textContent ?? "";
					if (!re.test(cardText)) continue;
					if (
						text === "Close" ||
						label === "close" ||
						label.includes("close") ||
						label === "dismiss"
					) {
						(btn as HTMLElement).click();
						acted = true;
					}
				}

				return acted;
			},
			{
				googleRe: PERPLEXITY_GOOGLE_SIGNIN_RE.source,
			},
		);
	}

	private async hasBlockingOverlays(session: BrowserSession): Promise<boolean> {
		return session.page.evaluate(
			({ googleRe, headingRe }) => {
				const google = new RegExp(googleRe, "i");
				const heading = new RegExp(headingRe, "i");

				const isVisible = (el: Element): boolean => {
					const style = window.getComputedStyle(el);
					const rect = el.getBoundingClientRect();
					return (
						style.display !== "none" &&
						style.visibility !== "hidden" &&
						rect.width > 0 &&
						rect.height > 0
					);
				};

				for (const btn of document.querySelectorAll("button")) {
					if (!isVisible(btn)) continue;
					const text = (btn.textContent ?? "").trim();
					if (/^(got it|decline optional)$/i.test(text)) return true;
					if (/^continue with (google|apple|email)$/i.test(text)) return true;
					const card = btn.closest("div, section, aside");
					const cardText = card?.textContent ?? "";
					if (google.test(cardText) && /^continue$/i.test(text)) return true;
				}

				for (const el of document.querySelectorAll(
					'[role="dialog"], [aria-modal="true"], div, section, aside',
				)) {
					if (!isVisible(el)) continue;
					const text = (el.textContent ?? "").trim();
					if (text.length > 900) continue;
					if (google.test(text) || heading.test(text)) {
						return true;
					}
				}

				return false;
			},
			{
				googleRe: PERPLEXITY_GOOGLE_SIGNIN_RE.source,
				headingRe: PERPLEXITY_LOGIN_MODAL_HEADING_RE.source,
			},
		);
	}

	private async focusAskInput(session: BrowserSession): Promise<void> {
		await session.page.evaluate(() => {
			const el = document.querySelector("#ask-input");
			if (el instanceof HTMLElement) {
				el.focus({ preventScroll: true });
			}
		});
	}

	private async prepareComposer(session: BrowserSession): Promise<void> {
		for (let attempt = 0; attempt < 4; attempt++) {
			await this.dismissPerplexityOverlays(session);
			await this.focusAskInput(session);
			await session.page.waitForTimeout(150);
			if (!(await this.hasBlockingOverlays(session))) {
				return;
			}
			await session.page.waitForTimeout(300);
		}

		if (await this.hasBlockingOverlays(session)) {
			this.logger.warn(
				"Perplexity overlays may still be visible; attempting submit anyway",
			);
		}
	}

	private async hasLoginSheetButtons(
		session: BrowserSession,
	): Promise<boolean> {
		return session.page.evaluate(() => {
			for (const btn of document.querySelectorAll("button")) {
				const text = (btn.textContent ?? "").trim();
				if (/^continue with (google|apple|email)$/i.test(text)) {
					return true;
				}
			}
			return false;
		});
	}

	private async dismissLoginSheet(session: BrowserSession): Promise<boolean> {
		let any = false;
		for (let round = 0; round < 5; round++) {
			const acted = await session.page.evaluate(() => {
				let clicked = false;
				for (const btn of document.querySelectorAll("button")) {
					const text = (btn.textContent ?? "").trim();
					const aria = btn.getAttribute("aria-label") ?? "";
					if (aria === "Close" || text === "Close") {
						(btn as HTMLElement).click();
						clicked = true;
					}
				}
				for (const el of document.querySelectorAll(
					'[role="dialog"], [aria-modal="true"]',
				)) {
					el.remove();
					clicked = true;
				}
				return clicked;
			});
			if (acted) any = true;
			if (!(await this.hasLoginSheetButtons(session))) {
				break;
			}
			await session.page.keyboard.press("Escape");
			await session.page.waitForTimeout(250);
		}
		return any;
	}

	private async dismissPerplexityOverlaysWithLocators(
		session: BrowserSession,
	): Promise<void> {
		const page = session.page;

		for (const name of ["Got it", "Decline optional"]) {
			try {
				const btn = page.getByRole("button", { name, exact: true });
				await btn.click({ timeout: 1500 });
				this.logger.info(`Clicked Perplexity overlay button: ${name}`);
				await page.waitForTimeout(250);
			} catch {
				// button not shown
			}
		}

		try {
			const googleCard = page
				.locator("div, section, aside")
				.filter({ hasText: PERPLEXITY_GOOGLE_SIGNIN_RE })
				.first();
			if (await googleCard.isVisible({ timeout: 500 })) {
				await googleCard.evaluate((el) => {
					el.remove();
				});
				this.logger.info("Removed Google sign-in card (locator)");
				await page.waitForTimeout(250);
			}
		} catch {
			// no google card
		}

		try {
			await page.keyboard.press("Escape");
		} catch {
			// ignore
		}
	}

	private async dismissPerplexityOverlays(
		session: BrowserSession,
	): Promise<void> {
		await this.dismissPerplexityOverlaysWithLocators(session);

		if (await this.dismissLoginSheet(session)) {
			this.logger.info("Dismissed Perplexity login sheet");
			await session.page.waitForTimeout(300);
		}

		if (await this.dismissCookieBanner(session)) {
			this.logger.info("Dismissed Perplexity cookie banner");
			await session.page.waitForTimeout(300);
		}

		if (await this.dismissGoogleSignInPrompt(session)) {
			this.logger.info("Dismissed Google sign-in prompt");
			await session.page.waitForTimeout(300);
		}

		for (let attempt = 0; attempt < 4; attempt++) {
			if (!(await this.hasLoginModal(session))) {
				break;
			}
			this.logger.info(
				`Perplexity login modal detected (attempt ${attempt + 1}); dismissing`,
			);
			await session.page.keyboard.press("Escape");
			await session.page.waitForTimeout(200);
			await session.page.keyboard.press("Escape");
			await session.page.waitForTimeout(200);
			if (await this.removeLoginModal(session)) {
				this.logger.info("Removed Perplexity login modal from DOM");
				await session.page.waitForTimeout(300);
			}
		}

		await this.dismissGoogleSignInPrompt(session);
		await this.dismissLoginSheet(session);

		if (await this.hasLoginModal(session)) {
			this.logger.warn(
				"Perplexity login modal may still be visible after dismissal attempts",
			);
		}
	}

	private async readAskInputValue(session: BrowserSession): Promise<string> {
		return session.page.evaluate(() => {
			const el = document.querySelector("#ask-input");
			if (!el) return "";
			if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
				return el.value;
			}
			return (el as HTMLElement).innerText ?? el.textContent ?? "";
		});
	}

	private async clearAskInputWithKeyboard(
		session: BrowserSession,
	): Promise<void> {
		await session.page.keyboard.press("ControlOrMeta+a");
		await session.page.keyboard.press("Backspace");
	}

	private async insertAskInputText(
		session: BrowserSession,
		query: string,
	): Promise<void> {
		await session.page.keyboard.insertText(query);
	}

	private async setAskInputViaDom(
		session: BrowserSession,
		query: string,
	): Promise<boolean> {
		return session.page.evaluate((text) => {
			const el = document.querySelector("#ask-input");
			if (!el) return false;

			if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
				const proto =
					el instanceof HTMLTextAreaElement
						? HTMLTextAreaElement.prototype
						: HTMLInputElement.prototype;
				const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
				descriptor?.set?.call(el, text);
				el.dispatchEvent(new Event("input", { bubbles: true }));
				el.dispatchEvent(new Event("change", { bubbles: true }));
				return true;
			}

			if (el instanceof HTMLElement) {
				el.textContent = "";
				el.textContent = text;
				el.dispatchEvent(
					new InputEvent("input", {
						bubbles: true,
						inputType: "insertText",
						data: text,
					}),
				);
				return true;
			}

			return false;
		}, query);
	}

	private async clearAndFillAskInput(
		session: BrowserSession,
		query: string,
	): Promise<void> {
		const input = session.page.locator("#ask-input").first();
		await this.dismissPerplexityOverlays(session);

		const domSet = await this.setAskInputViaDom(session, query);
		if (!domSet) {
			await input.click({ timeout: 10_000, force: true });
			await this.clearAskInputWithKeyboard(session);
			await this.insertAskInputText(session, query);
		}

		const expected = normalizePerplexityQueryText(query);
		for (let attempt = 0; attempt < 3; attempt++) {
			const actual = normalizePerplexityQueryText(
				await this.readAskInputValue(session),
			);
			if (actual === expected) {
				return;
			}
			if (isDuplicatedPerplexityQuery(actual, query)) {
				this.logger.warn(
					"Ask input contained duplicated query text; clearing via keyboard",
				);
			} else {
				this.logger.warn(
					`Ask input mismatch (len ${actual.length} vs ${expected.length}); resetting`,
				);
			}
			await this.clearAskInputWithKeyboard(session);
			await this.insertAskInputText(session, query);
		}

		const finalValue = normalizePerplexityQueryText(
			await this.readAskInputValue(session),
		);
		if (finalValue !== expected) {
			throw new Error(
				`Failed to set Perplexity ask input (got ${finalValue.length} chars, expected ${expected.length})`,
			);
		}
	}

	private async clickAskSubmitButton(
		session: BrowserSession,
	): Promise<boolean> {
		return session.page.evaluate(() => {
			const input = document.querySelector("#ask-input");
			if (!input) return false;
			const inputRect = input.getBoundingClientRect();

			const isToolbarLabelButton = (btn: HTMLButtonElement): boolean => {
				const text = (btn.textContent ?? "").trim();
				if (!text) return false;
				return /^(search|work|model|attach|pro|sources)$/i.test(text);
			};

			const candidates: Array<{ btn: HTMLButtonElement; score: number }> = [];

			for (const btn of document.querySelectorAll("button")) {
				if (!(btn instanceof HTMLButtonElement) || btn.disabled) continue;
				const label = (btn.getAttribute("aria-label") ?? "").toLowerCase();
				const text = (btn.textContent ?? "").trim();
				if (
					/sign in|log in|google|apple|continue with|single sign-on|sso/i.test(
						`${text} ${label}`,
					)
				) {
					continue;
				}
				if (isToolbarLabelButton(btn)) continue;
				if (btn.closest('[role="dialog"], [aria-modal="true"]')) continue;

				const rect = btn.getBoundingClientRect();
				if (rect.width <= 0 || rect.height <= 0) continue;
				if (rect.left < inputRect.left - 20) continue;
				if (Math.abs(rect.bottom - inputRect.bottom) > 72) continue;

				let score = rect.left;
				if (label.includes("submit") || label.includes("send")) score += 10_000;
				if (!text) score += 500;
				candidates.push({ btn, score });
			}

			candidates.sort((a, b) => b.score - a.score);
			const best = candidates[0]?.btn;
			if (!best) return false;
			best.click();
			return true;
		});
	}

	private async requestComposerSubmit(
		session: BrowserSession,
	): Promise<boolean> {
		return session.page.evaluate(() => {
			const input = document.querySelector("#ask-input");
			const form = input?.closest("form");
			if (form instanceof HTMLFormElement) {
				form.requestSubmit();
				return true;
			}
			return false;
		});
	}

	private async waitForSearchRoute(session: BrowserSession): Promise<boolean> {
		try {
			await session.page.waitForURL(/\/search\//, {
				timeout: PERPLEXITY_SUBMIT_WAIT_MS,
			});
			return true;
		} catch {
			return false;
		}
	}

	private async hasLoginWall(session: BrowserSession): Promise<boolean> {
		return session.page.evaluate(() => {
			const bodyText = document.body?.innerText ?? "";
			const normalized = bodyText.replace(/\s+/g, " ").trim();
			if (/sign up and repeat your request/i.test(normalized)) {
				return true;
			}
			if (
				/something went wrong/i.test(normalized) &&
				/sign up/i.test(normalized)
			) {
				return true;
			}
			return false;
		});
	}

	private async submitAskInput(
		session: BrowserSession,
		_query: string,
	): Promise<void> {
		const askInput = session.page.locator("#ask-input").first();

		await this.prepareComposer(session);

		if (await this.requestComposerSubmit(session)) {
			this.logger.info("Submitted Perplexity query via form.requestSubmit()");
			if (await this.waitForSearchRoute(session)) {
				return;
			}
		}

		await this.prepareComposer(session);
		this.logger.info("Submitting with Enter on #ask-input");
		await askInput.focus();
		await askInput.press("Enter");
		if (await this.waitForSearchRoute(session)) {
			return;
		}

		await this.prepareComposer(session);
		if (await this.clickAskSubmitButton(session)) {
			this.logger.info("Submitting via composer arrow button");
			if (await this.waitForSearchRoute(session)) {
				return;
			}
		}

		const blocked = await this.hasBlockingOverlays(session);
		throw new Error(
			blocked
				? "Perplexity query submit failed: overlays are blocking the composer"
				: "Perplexity query submit failed: did not navigate to /search/",
		);
	}

	async waitForResponse(session: BrowserSession): Promise<void> {
		await session.page.waitForLoadState("domcontentloaded");
		await this.waitForCloudflareChallenge(session);
		await this.dismissPerplexityOverlays(session);

		if (await this.hasLoginWall(session)) {
			throw new Error(
				"Login wall detected - Perplexity requires sign-in to view answer",
			);
		}

		this.logger.info("Waiting for Perplexity response to finish streaming...");
		const maxWait = 60000;
		const pollInterval = 300;
		const stableWindowMs = 1500;
		const copyReadyStableMs = 2000;
		let elapsed = 0;
		let seenContent = false;
		let lastSignature = "";
		let stableSince = 0;
		let lastContentLength = 0;
		let lastLoggedBucket = -1;

		while (elapsed < maxWait) {
			if (elapsed % 1500 < pollInterval) {
				await this.dismissPerplexityOverlays(session);
			}
			await this.assertNoLoginWall(session, "while waiting for answer");

			const state = await session.page.evaluate(PERPLEXITY_RESPONSE_STATE_FN);

			if (state.contentLength > 0) {
				seenContent = true;
			}
			lastContentLength = state.contentLength;

			const signature = `${state.isStreaming}:${state.contentLength}:${state.hasCopyButton}`;
			if (signature !== lastSignature) {
				lastSignature = signature;
				stableSince = elapsed;
			}

			const stableFor = elapsed - stableSince;

			const copyReady =
				state.hasCopyButton &&
				state.contentLength >= 80 &&
				stableFor >= copyReadyStableMs;

			const copyButtonStable =
				state.hasCopyButton && stableFor >= 2500 && !state.isStreaming;

			const streamDone =
				!state.isStreaming && seenContent && stableFor >= stableWindowMs;

			if (copyReady || copyButtonStable || streamDone) {
				this.logger.info(
					`Response finished (content: ${state.contentLength} chars, copy: ${state.hasCopyButton}, streaming: ${state.isStreaming}, stable for ${stableFor}ms)`,
				);
				return;
			}

			const bucket = Math.floor(elapsed / 5000);
			if (bucket !== lastLoggedBucket) {
				this.logger.info(
					`Still waiting... (${elapsed / 1000}s, content: ${state.contentLength} chars, copy: ${state.hasCopyButton}, streaming: ${state.isStreaming})`,
				);
				lastLoggedBucket = bucket;
			}

			await session.page.waitForTimeout(pollInterval);
			elapsed += pollInterval;
		}

		await this.assertNoLoginWall(session, "after response wait timeout");

		this.logger.info(
			`Response wait timed out at ${elapsed / 1000}s (content: ${lastContentLength} chars)`,
		);
	}

	private async queryAnswerProseHtml(session: BrowserSession): Promise<string> {
		const selectors = [...PERPLEXITY_ANSWER_SELECTORS];
		return session.page.evaluate((sels) => {
			for (const sel of sels) {
				const answerEl = document.querySelector(sel);
				if (answerEl?.textContent && answerEl.textContent.trim().length > 50) {
					return answerEl.getHTML();
				}
			}
			return document.body.getHTML();
		}, selectors);
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
				await this.dismissPerplexityOverlays(session);
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
					content = toMarkdown(await this.queryAnswerProseHtml(session));
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
					content = toMarkdown(await this.queryAnswerProseHtml(session));
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
					content = toMarkdown(await this.queryAnswerProseHtml(session));
				}
			} catch (error) {
				this.logger.warn("Clipboard also failed, using DOM extraction", error);
				content = toMarkdown(await this.queryAnswerProseHtml(session));
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
		this.logger.info(`Inline links: ${structured.inlineLinks.length}`);
		this.logger.info(
			`Related questions: ${structured.relatedQuestions?.length ?? 0}`,
		);

		const isLikelyLoginWall = perplexityBodyHasLoginWall(content);
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
		const inlineLinks = await this.extractInlineLinks(session);
		const relatedQuestions = await this.extractRelatedQuestions(session);
		const answerFormat = this.detectAnswerFormat(session);

		return {
			inlineLinks,
			sourcePanelLinks: [],
			brandMentions: [],
			relatedQuestions,
			answerFormat,
		};
	}

	private async extractInlineLinks(
		session: BrowserSession,
	): Promise<InlineLink[]> {
		const inlineLinks: InlineLink[] = [];

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

				inlineLinks.push({
					domain,
					url: link.href,
					position: position++,
					title: link.text.split(/\s+/)[0]?.toLowerCase() ?? domain,
				});
			}
		} catch {
			// Inline links extraction is non-critical
		}

		return inlineLinks;
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

	classifyError(error: Error): FailureType {
		const msg = error.message.toLowerCase();
		const causeMsg = error.cause
			? (error.cause instanceof Error
					? error.cause.message
					: String(error.cause)
				).toLowerCase()
			: "";
		const combined = `${msg} ${causeMsg}`;

		if (/search input.*not found|#ask-input.*not found/i.test(combined)) {
			return "no_editor";
		}
		if (/cloudflare.*challenge.*timeout|cloudflare.*timeout/i.test(combined)) {
			return "bot_detection";
		}
		if (/login wall detected/i.test(combined)) {
			return "logged_out";
		}
		if (/extraction failed.*content too short/i.test(combined)) {
			return "extraction_failed";
		}
		return "unknown";
	}
}
