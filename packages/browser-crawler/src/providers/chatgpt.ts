import type { BrowserSession } from "../types";
import type { CrawlerProvider } from "./base";
import type { CrawlResult, InlineLink } from "./types";
import type { FailureType } from "../errors";
import type { Logger } from "@opencited/logger";
import { defaultLogger } from "@opencited/logger";
import { toMarkdown } from "./turndown";
import { filterSelfCitations } from "./self-citation-filter";

const AUTH_MODAL_SELECTOR = '[role="dialog"][data-state="open"]';
const AUTH_MODAL_TEXT_RE = /Thanks for trying ChatGPT|Log in or sign up/i;
const PROVIDER_BUILD = "2026-06-29-chatgpt-logs";

export const PROVIDER_TIMINGS = {
	noOutputTimeout: 90_000,
	forceExitStable: 45_000,
	typing: {
		chunkMin: 3,
		chunkMax: 8,
		delayMin: 12,
		delayMax: 28,
		thinkPauseEveryMin: 22,
		thinkPauseEveryMax: 40,
	},
	click: {
		delayMin: 35,
		delayMax: 120,
	},
} as const;

export class ChatGPTProvider implements CrawlerProvider {
	readonly name = "chatgpt";
	readonly requiresAuth = false;
	private initialUrl: string | null = null;
	private logger: Logger;
	/**
	 * How long `extractFromSourcesPanel` will poll for the Sources button
	 * to appear after `waitForResponse` returns. ChatGPT sometimes adds
	 * the button 1-3s after the response content stops streaming. Default
	 * 1000ms is enough for the typical race; tests can set to 0 to skip.
	 */
	public sourcesPanelPollMs = 1000;

	constructor(logger?: Logger) {
		this.logger = logger ?? defaultLogger;
		this.logger.info(`ChatGPTProvider loaded (build: ${PROVIDER_BUILD})`);
	}

	private async hasAuthModal(session: BrowserSession): Promise<boolean> {
		return session.page.evaluate(
			({ selector, textRe }) => {
				const dialogs = document.querySelectorAll(selector);
				for (const el of dialogs) {
					if (new RegExp(textRe).test(el.textContent ?? "")) {
						return true;
					}
				}
				return false;
			},
			{ selector: AUTH_MODAL_SELECTOR, textRe: AUTH_MODAL_TEXT_RE.source },
		);
	}

	private async removeAuthModal(session: BrowserSession): Promise<boolean> {
		return session.page.evaluate(
			({ selector, textRe }) => {
				const dialogs = document.querySelectorAll(selector);
				for (const el of dialogs) {
					if (new RegExp(textRe).test(el.textContent ?? "")) {
						(el as HTMLElement).remove();
						return true;
					}
				}
				return false;
			},
			{ selector: AUTH_MODAL_SELECTOR, textRe: AUTH_MODAL_TEXT_RE.source },
		);
	}

	private async dismissAuthModal(
		session: BrowserSession,
		timeoutMs: number,
		source: string,
	): Promise<void> {
		const present = await this.hasAuthModal(session);
		this.logger.info(`[chatgpt:${source}] checking auth modal`, {
			present,
			timeoutMs,
		});
		if (!present) return;

		await session.page.waitForTimeout(timeoutMs);

		await session.page.keyboard.press("Escape");
		await session.page.waitForTimeout(150);
		this.logger.info(`[chatgpt:${source}] pressed Escape to dismiss modal`);

		if (await this.hasAuthModal(session)) {
			const removed = await this.removeAuthModal(session);
			this.logger.info(
				`[chatgpt:${source}] ⚠️ Escape did not dismiss modal; removed via DOM`,
				{
					removed,
				},
			);
			if (!removed) {
				throw new Error(
					"Auth modal detected but Escape did not dismiss it and the dialog could not be removed",
				);
			}
		}
	}

	private async dismissAuthModalIfPresent(
		session: BrowserSession,
		chunkIndex: number,
	): Promise<void> {
		if (!(await this.hasAuthModal(session))) return;

		this.logger.info(
			`[chatgpt:typing] ⚠️ auth modal appeared during typing (chunk ${chunkIndex}); dismissing`,
		);

		await session.page.keyboard.press("Escape");
		await session.page.waitForTimeout(100);

		if (await this.hasAuthModal(session)) {
			await this.removeAuthModal(session);
		}
	}

	async beforePrompt(session: BrowserSession, _query: string): Promise<void> {
		await this.dismissAuthModal(session, 500, "beforePrompt");
	}

	async afterTyping(session: BrowserSession, _query: string): Promise<void> {
		await this.dismissAuthModal(session, 1500, "afterTyping");
	}

	async beforeSubmit(session: BrowserSession, _query: string): Promise<void> {
		await this.dismissAuthModal(session, 1500, "beforeSubmit");
	}

	async afterSubmit(session: BrowserSession, _query: string): Promise<void> {
		await this.dismissAuthModal(session, 1500, "afterSubmit");
	}

	async navigate(session: BrowserSession): Promise<void> {
		this.logger.info("[chatgpt:navigate] goto https://chatgpt.com/", {
			waitUntil: "load",
		});
		await session.page.goto("https://chatgpt.com/", {
			waitUntil: "load",
		});
		const title = await session.page.title();
		this.logger.info("[chatgpt:navigate] page loaded", {
			url: session.page.url(),
			title,
		});
	}

	private randomBetween(min: number, max: number): number {
		return Math.floor(Math.random() * (max - min + 1)) + min;
	}

	private async typeWithHumanDelay(
		session: BrowserSession,
		query: string,
	): Promise<boolean> {
		const {
			chunkMin,
			chunkMax,
			delayMin,
			delayMax,
			thinkPauseEveryMin,
			thinkPauseEveryMax,
		} = PROVIDER_TIMINGS.typing;

		let chunksSincePause = 0;
		const pauseEvery = this.randomBetween(
			thinkPauseEveryMin,
			thinkPauseEveryMax,
		);

		this.logger.info("[chatgpt:typing] starting", {
			queryLength: query.length,
			chunkMin,
			chunkMax,
			pauseEvery,
		});

		let pos = 0;
		let chunkIndex = 0;
		while (pos < query.length) {
			const remaining = query.length - pos;
			const maxChunk = Math.min(chunkMax, remaining);
			const chunkSize =
				remaining <= chunkMax
					? remaining
					: this.randomBetween(chunkMin, maxChunk);
			const chunk = query.slice(pos, pos + chunkSize);
			await session.page.keyboard.type(chunk);
			chunksSincePause++;
			chunkIndex++;

			await this.dismissAuthModalIfPresent(session, chunkIndex);

			await this.ensureEditorFocus(session, chunkIndex, pos + chunkSize);

			if (await this.wasSubmittedEarly(session)) {
				const editorState = await this.captureEditorState(session);
				this.logger.info(
					"[chatgpt:typing] ⚠️ aborted — page appears to have submitted early (input cleared / URL changed / input hidden)",
					{
						chunksTyped: chunkIndex,
						charsTyped: pos + chunkSize,
						queryLength: query.length,
						editorState,
					},
				);
				return false;
			}

			if (chunksSincePause >= pauseEvery && pos + chunkSize < query.length) {
				const pauseMs = this.randomBetween(120, 260);
				this.logger.debug(
					`[chatgpt:typing] think-pause ${pauseMs}ms after chunk ${chunkIndex}`,
				);
				await session.page.waitForTimeout(pauseMs);
				chunksSincePause = 0;
			} else if (pos + chunkSize < query.length) {
				await session.page.waitForTimeout(
					this.randomBetween(delayMin, delayMax),
				);
			}

			pos += chunkSize;
		}
		const finalState = await this.isEditorFocusedAndReady(session);
		this.logger.info("[chatgpt:typing] completed", {
			chunksTyped: chunkIndex,
			charsTyped: pos,
			queryLength: query.length,
			finalEditorTextLength: finalState.editorTextLength,
			finalEditorFocused: finalState.focused,
			documentHasFocus: finalState.documentHasFocus,
		});
		return true;
	}

	private async captureEditorState(session: BrowserSession): Promise<{
		url: string;
		editorText: string | null;
		editorTextLength: number;
		editorHidden: boolean;
		dialogPresent: boolean;
		dialogText: string | null;
	}> {
		try {
			return await session.page.evaluate(() => {
				const editor = document.querySelector(
					"#prompt-textarea.ProseMirror",
				) as HTMLElement | null;
				const textContent = editor?.textContent ?? "";
				const rect = editor?.getBoundingClientRect();
				const editorHidden = !rect || rect.height === 0;
				const dialog = document.querySelector(
					'[role="dialog"][data-state="open"]',
				);
				const dialogText = (dialog?.textContent ?? "")
					.slice(0, 80)
					.replace(/\s+/g, " ")
					.trim();
				return {
					url: window.location.href,
					editorText: textContent.length > 0 ? textContent.slice(0, 120) : null,
					editorTextLength: textContent.length,
					editorHidden,
					dialogPresent: !!dialog,
					dialogText: dialogText || null,
				};
			});
		} catch (e) {
			return {
				url: "<evaluate-failed>",
				editorText: null,
				editorTextLength: -1,
				editorHidden: false,
				dialogPresent: false,
				dialogText: `evaluate-failed: ${e instanceof Error ? e.message : String(e)}`,
			};
		}
	}

	private async isEditorFocusedAndReady(
		session: BrowserSession,
	): Promise<{
		focused: boolean;
		documentHasFocus: boolean;
		editorTextLength: number;
	}> {
		try {
			return await session.page.evaluate(() => {
				const editor = document.querySelector(
					"#prompt-textarea.ProseMirror",
				) as HTMLElement | null;
				const focused = !!editor && document.activeElement === editor;
				const textContent = editor?.textContent ?? "";
				return {
					focused,
					documentHasFocus: document.hasFocus(),
					editorTextLength: textContent.length,
				};
			});
		} catch {
			return { focused: false, documentHasFocus: false, editorTextLength: -1 };
		}
	}

	private async ensureEditorFocus(
		session: BrowserSession,
		chunkIndex: number,
		pos: number,
	): Promise<void> {
		const before = await this.isEditorFocusedAndReady(session);
		if (before.focused) return;

		this.logger.info(
			`[chatgpt:typing] ⚠️ editor lost focus after chunk ${chunkIndex} (typed ${pos} chars, editor has ${before.editorTextLength} chars, document.hasFocus=${before.documentHasFocus}); re-focusing`,
		);

		try {
			await session.page.focus("#prompt-textarea.ProseMirror");
		} catch (e) {
			this.logger.info(
				`[chatgpt:typing] ⚠️ re-focus failed at chunk ${chunkIndex}`,
				{ error: e instanceof Error ? e.message : String(e) },
			);
			return;
		}

		const after = await this.isEditorFocusedAndReady(session);
		this.logger.info(
			`[chatgpt:typing] re-focus result for chunk ${chunkIndex}`,
			{
				focused: after.focused,
				documentHasFocus: after.documentHasFocus,
				editorTextLength: after.editorTextLength,
			},
		);
	}

	private async wasSubmittedEarly(session: BrowserSession): Promise<boolean> {
		const initialUrl = this.initialUrl;
		try {
			const result = await session.page.evaluate(
				({ initialUrl }) => {
					const editor = document.querySelector("#prompt-textarea.ProseMirror");
					const textContent = editor?.textContent?.trim() ?? "";
					const inputCleared = textContent.length === 0;

					const urlChanged =
						initialUrl !== null && window.location.href !== initialUrl;

					const rect = editor?.getBoundingClientRect();
					const inputHidden = !rect || rect.height === 0;

					const wasSubmittedEarly = inputCleared || urlChanged || inputHidden;
					return {
						wasSubmittedEarly,
						inputCleared,
						urlChanged,
						inputHidden,
						editorTextLength: textContent.length,
						currentUrl: window.location.href,
						initialUrl,
					};
				},
				{ initialUrl },
			);
			if (result.wasSubmittedEarly) {
				this.logger.debug("[chatgpt:typing] early-submit signal detected", {
					inputCleared: result.inputCleared,
					urlChanged: result.urlChanged,
					inputHidden: result.inputHidden,
					editorTextLength: result.editorTextLength,
					currentUrl: result.currentUrl,
					initialUrl: result.initialUrl,
				});
			}
			return result.wasSubmittedEarly;
		} catch (e) {
			this.logger.info(
				"[chatgpt:typing] ⚠️ wasSubmittedEarly evaluate threw — assuming early submit",
				{ error: e instanceof Error ? e.message : String(e) },
			);
			return true;
		}
	}

	private async verifySubmissionSuccess(
		session: BrowserSession,
	): Promise<boolean> {
		const initialUrl = this.initialUrl;
		const checks = await session.page.evaluate(
			({ initialUrl }) => {
				const editor = document.querySelector("#prompt-textarea.ProseMirror");
				const textContent = editor?.textContent?.trim() ?? "";
				const inputCleared = textContent.length === 0;

				const urlChanged =
					initialUrl !== null && window.location.href !== initialUrl;

				const rect = editor?.getBoundingClientRect();
				const inputHidden = !rect || rect.height === 0;

				return { inputCleared, urlChanged, inputHidden };
			},
			{ initialUrl },
		);

		if (checks.inputCleared || checks.urlChanged || checks.inputHidden) {
			await session.page.waitForTimeout(200);
			const doubleCheck = await session.page.evaluate(() => {
				const editor = document.querySelector("#prompt-textarea.ProseMirror");
				const textContent = editor?.textContent?.trim() ?? "";
				return textContent.length === 0;
			});
			return (
				doubleCheck ||
				checks.inputCleared ||
				checks.urlChanged ||
				checks.inputHidden
			);
		}

		return false;
	}

	private async submitWithFallback(session: BrowserSession): Promise<void> {
		const strategyNames = [
			"press Enter",
			"click send button",
			"dispatch keydown Enter",
			"dispatch input insertParagraph",
		];

		const strategies: Array<() => Promise<boolean>> = [
			async () => {
				this.logger.debug("[chatgpt:submit] strategy 1/4: press Enter");
				await session.page.keyboard.press("Enter");
				await session.page.waitForTimeout(200);
				return this.verifySubmissionSuccess(session);
			},
			async () => {
				this.logger.debug(
					"[chatgpt:submit] strategy 2/4: click send button via JS",
				);
				const clicked = await session.page.evaluate(() => {
					const selectors = [
						'button[data-testid="send-button"]',
						'button[aria-label="Send prompt"]',
						'button[aria-label="Send"]',
						"form button[type='submit']",
					];
					for (const sel of selectors) {
						const btn = document.querySelector(sel) as HTMLElement | null;
						if (btn) {
							btn.click();
							return true;
						}
					}
					return false;
				});
				if (!clicked) return false;
				await session.page.waitForTimeout(200);
				return this.verifySubmissionSuccess(session);
			},
			async () => {
				this.logger.debug(
					"[chatgpt:submit] strategy 3/4: dispatch keydown Enter on editor",
				);
				const dispatched = await session.page.evaluate(() => {
					const editor = document.querySelector(
						"#prompt-textarea.ProseMirror",
					) as HTMLElement | null;
					if (!editor) return false;
					const enterEvent = new KeyboardEvent("keydown", {
						key: "Enter",
						code: "Enter",
						bubbles: true,
						cancelable: true,
					});
					editor.dispatchEvent(enterEvent);
					return true;
				});
				if (!dispatched) return false;
				await session.page.waitForTimeout(200);
				return this.verifySubmissionSuccess(session);
			},
			async () => {
				this.logger.debug(
					"[chatgpt:submit] strategy 4/4: dispatch input insertParagraph on editor",
				);
				const dispatched = await session.page.evaluate(() => {
					const editor = document.querySelector(
						"#prompt-textarea.ProseMirror",
					) as HTMLElement | null;
					if (!editor) return false;
					const inputEvent = new InputEvent("input", {
						inputType: "insertParagraph",
						bubbles: true,
						cancelable: true,
					});
					editor.dispatchEvent(inputEvent);
					return true;
				});
				if (!dispatched) return false;
				await session.page.waitForTimeout(200);
				return this.verifySubmissionSuccess(session);
			},
		];

		for (let i = 0; i < strategies.length; i++) {
			const success = await strategies[i]?.();
			this.logger.info(
				`[chatgpt:submit] strategy ${i + 1}/${strategies.length}: ${strategyNames[i]} → ${success ? "success" : "no-op"}`,
			);
			if (success) {
				this.logger.info(`[chatgpt:submit] submitted via strategy ${i + 1}`);
				return;
			}
		}

		throw new Error(
			"All submission strategies failed — submission_failed: Enter key, native click, force dispatch, and dispatch event all failed to submit the query",
		);
	}

	async submitQuery(session: BrowserSession, query: string): Promise<void> {
		this.initialUrl = session.page.url();
		this.logger.info("[chatgpt:submitQuery] start", {
			initialUrl: this.initialUrl,
			queryLength: query.length,
		});

		const sanitizedQuery = query.replace(/[\r\n]+/g, " ");
		if (sanitizedQuery !== query) {
			this.logger.info(
				"[chatgpt:submitQuery] sanitized newlines in query to spaces",
				{
					originalLength: query.length,
					sanitizedLength: sanitizedQuery.length,
				},
			);
		}

		// In non-headless mode the OS browser window can lose focus while the
		// worker's terminal is focused; the page then silently drops keystrokes
		// after the first few. Bring the page to the front so document.hasFocus()
		// is true while we type.
		try {
			await session.page.bringToFront();
			this.logger.info("[chatgpt:submitQuery] page brought to front");
		} catch (e) {
			this.logger.info(
				"[chatgpt:submitQuery] bringToFront failed (continuing)",
				{ error: e instanceof Error ? e.message : String(e) },
			);
		}

		try {
			await session.page.focus("#prompt-textarea.ProseMirror");
			this.logger.info("[chatgpt:submitQuery] focused ProseMirror editor", {
				selector: "#prompt-textarea.ProseMirror",
			});
		} catch (e) {
			const currentUrl = session.page.url();
			const pageTitle = await session.page.title();
			this.logger.info("[chatgpt:submitQuery] ❌ focus failed", {
				selector: "#prompt-textarea.ProseMirror",
				url: currentUrl,
				title: pageTitle,
				error: e instanceof Error ? e.message : String(e),
			});
			throw new Error(
				`ProseMirror editor #prompt-textarea not found or not focusable. URL: ${currentUrl}, Title: "${pageTitle}"`,
			);
		}

		const focusState = await this.isEditorFocusedAndReady(session);
		this.logger.info("[chatgpt:submitQuery] focus state before typing", {
			editorFocused: focusState.focused,
			documentHasFocus: focusState.documentHasFocus,
			editorTextLength: focusState.editorTextLength,
		});

		const { delayMin, delayMax } = PROVIDER_TIMINGS.click;
		const clickDelay = this.randomBetween(delayMin, delayMax);
		this.logger.info(
			`[chatgpt:submitQuery] pre-type settle ${clickDelay}ms (range ${delayMin}-${delayMax}ms)`,
		);
		await session.page.waitForTimeout(clickDelay);

		const typingCompleted = await this.typeWithHumanDelay(
			session,
			sanitizedQuery,
		);

		if (typingCompleted) {
			const finalState = await this.captureEditorState(session);
			this.logger.info(
				"[chatgpt:submitQuery] typing completed; invoking submitWithFallback",
				{
					finalEditorTextLength: finalState.editorTextLength,
					url: finalState.url,
					editorFocused: focusState.focused,
				},
			);
			await this.submitWithFallback(session);
		} else {
			this.logger.info(
				"[chatgpt:submitQuery] ⚠️ typing aborted; skipping submitWithFallback (form likely already submitted)",
			);
		}
	}

	async waitForResponse(session: BrowserSession): Promise<void> {
		const pollInterval = 300;
		const jitterRange = 50;
		const stableWindow = 1500;
		const maxWait = PROVIDER_TIMINGS.forceExitStable;

		this.logger.info("[chatgpt:waitForResponse] start", { maxWait });

		let elapsed = 0;
		let seenContent = false;
		let lastResponseSig = "";
		let lastGenerationSig = "";
		let stableSince = 0;
		let lastLoggedBucket = -1;

		while (elapsed < maxWait) {
			const state = await session.page.evaluate(() => {
				const stopButton = document.querySelector(
					'button[data-testid="stop-button"]',
				);
				const stopVisible = !!stopButton;
				const stopText = stopButton?.textContent?.trim() ?? "";
				const stopAriaLabel = stopButton?.getAttribute("aria-label") ?? "";
				const stopDisabled =
					stopButton?.getAttribute("aria-disabled") === "true";

				const responseEls = document.querySelectorAll(
					'[data-message-author-role="assistant"]',
				);
				let lastEl: Element | null = null;
				for (const el of responseEls) {
					const style = window.getComputedStyle(el);
					if (style.display !== "none" && style.visibility !== "hidden") {
						lastEl = el;
					}
				}

				const textContent = lastEl?.textContent ?? "";
				const textLength = textContent.length;
				const innerHTML = (lastEl as HTMLElement)?.innerHTML ?? "";
				const innerHTMLLen = innerHTML.length;
				const childCount = lastEl?.children.length ?? 0;
				const textTail =
					textLength > 120 ? textContent.slice(-120) : textContent;

				return {
					textLength,
					innerHTMLLen,
					childCount,
					textTail,
					stopVisible,
					stopText,
					stopAriaLabel,
					stopDisabled,
				};
			});

			if (state.textLength > 0) {
				seenContent = true;
			}

			const responseSig = `${state.textLength}:${state.innerHTMLLen}:${state.childCount}:${state.textTail}`;
			const generationSig = `${state.stopVisible}:${state.stopText}:${state.stopAriaLabel}:${state.stopDisabled}`;

			if (
				responseSig === lastResponseSig &&
				generationSig === lastGenerationSig
			) {
				if (!state.stopVisible && seenContent) {
					const stableFor = elapsed - stableSince;
					if (stableFor >= stableWindow) {
						this.logger.info("[chatgpt:waitForResponse] stable — done", {
							elapsedMs: elapsed,
							finalTextLength: state.textLength,
						});
						return;
					}
				}
			} else {
				const bucket = Math.floor(elapsed / 2000);
				if (bucket !== lastLoggedBucket) {
					this.logger.info("[chatgpt:waitForResponse] streaming", {
						elapsedMs: elapsed,
						textLength: state.textLength,
						stopVisible: state.stopVisible,
					});
					lastLoggedBucket = bucket;
				}
				lastResponseSig = responseSig;
				lastGenerationSig = generationSig;
				stableSince = elapsed;
			}

			const jitter =
				Math.floor(Math.random() * (jitterRange * 2 + 1)) - jitterRange;
			const waitMs = pollInterval + jitter;
			await session.page.waitForTimeout(waitMs);
			elapsed += pollInterval;
		}
		this.logger.info(
			"[chatgpt:waitForResponse] ⚠️ timed out without stability",
			{
				maxWait,
				seenContent,
			},
		);
	}

	private async findLatestResponseElement(session: BrowserSession): Promise<{
		innerHTML: string;
		outerHTML: string;
		processedHTML: string;
	} | null> {
		const result = await session.page.evaluate(() => {
			const elements = document.querySelectorAll(
				'[data-message-author-role="assistant"]',
			);
			let lastVisible: Element | null = null;
			for (const el of elements) {
				const style = window.getComputedStyle(el);
				if (style.display !== "none" && style.visibility !== "hidden") {
					lastVisible = el;
				}
			}
			if (!lastVisible) return null;

			const clone = lastVisible.cloneNode(true) as HTMLElement;

			for (const el of clone.querySelectorAll('[aria-hidden="true"]')) {
				el.remove();
			}
			for (const el of clone.querySelectorAll("sup")) {
				el.remove();
			}
			for (const el of clone.querySelectorAll("button")) {
				el.remove();
			}
			for (const el of clone.querySelectorAll(
				'[data-testid="copy-turn-action-button"], [data-testid="thumbs-up-button"], [data-testid="thumbs-down-button"], [data-testid="share-turn-action-button"]',
			)) {
				el.remove();
			}

			return {
				innerHTML: (lastVisible as HTMLElement).innerHTML,
				outerHTML: (lastVisible as HTMLElement).outerHTML,
				processedHTML: clone.innerHTML,
			};
		});

		return result;
	}

	private async extractInlineLinks(
		session: BrowserSession,
	): Promise<import("./types").InlineLink[]> {
		const links = await session.page.evaluate(() => {
			const responseEls = document.querySelectorAll(
				'[data-message-author-role="assistant"]',
			);
			let lastVisible: Element | null = null;
			for (const el of responseEls) {
				const style = window.getComputedStyle(el);
				if (style.display !== "none" && style.visibility !== "hidden") {
					lastVisible = el;
				}
			}
			if (!lastVisible) return [];

			const anchors = lastVisible.querySelectorAll("a.decorated-link");
			const out: Array<{
				title: string;
				url: string;
				domain: string;
				position: number;
			}> = [];
			Array.from(anchors).forEach((a, i) => {
				const href = (a as HTMLAnchorElement).href;
				if (!href) return;
				let domain = "";
				try {
					domain = new URL(href).hostname.replace("www.", "");
				} catch {
					return;
				}
				out.push({
					title: a.textContent?.trim() ?? "",
					url: href,
					domain,
					position: i + 1,
				});
			});
			return out;
		});

		return links;
	}

	private async findSourcesButton(
		session: BrowserSession,
	): Promise<{
		found: boolean;
		score?: number;
		tag?: string;
		text?: string;
		ariaLabel?: string;
	}> {
		return session.page.evaluate(() => {
			const TEXT_RE = /\b\d+\s*sources?\b/i;
			const ARIA_RE = /\bsources?\b/i;
			// ChatGPT's "Sources" footnote button is rendered with this Tailwind
			// `group/footnote` class. The chat-history sidebar toggle ("Sources"
			// hamburger) does NOT have this class. This is the single most
			// reliable distinguishing signal in the current UI.
			const FOOTNOTE_CLASS = "footnote";

			const responseEls = document.querySelectorAll(
				'[data-message-author-role="assistant"]',
			);
			const lastResp = responseEls[
				responseEls.length - 1
			] as HTMLElement | null;
			const responseBottom = lastResp
				? lastResp.getBoundingClientRect().bottom
				: 0;

			const candidates = document.querySelectorAll(
				'button, [role="button"], a[href]',
			);

			let bestEl: Element | null = null;
			let bestScore = 0;
			let bestText = "";
			let bestAria = "";

			for (const el of candidates) {
				const text = el.textContent?.trim() ?? "";
				const ariaLabel = el.getAttribute("aria-label") ?? "";
				const className = el.getAttribute("class") ?? "";
				const rect = el.getBoundingClientRect();

				const isFootnote = className.toLowerCase().includes(FOOTNOTE_CLASS);
				const isBelowResponse = lastResp !== null && rect.top > responseBottom;

				let score = 0;
				if (TEXT_RE.test(text)) score += 120;
				if (ARIA_RE.test(ariaLabel)) score += 90;
				if (isFootnote) score += 50;
				if (isBelowResponse) score += 50;

				if (score > bestScore) {
					bestScore = score;
					bestEl = el;
					bestText = text;
					bestAria = ariaLabel;
				}
			}

			// Real sources button: aria "Sources" (90) + footnote (50) +
			// below response (50) = 190. Old N-sources button: 120 + 50 + 50 =
			// 220. The top-of-page "Sources" sidebar toggle scores only 90
			// (aria) — both new signals are 0 — so it is correctly rejected.
			// Inline citation <a>s inside the response score only 0 (no aria
			// "Sources", not a footnote, not below the response) — rejected.
			if (!bestEl || bestScore < 140) {
				return { found: false };
			}

			return {
				found: true,
				score: bestScore,
				tag: bestEl.tagName.toLowerCase(),
				text: bestText,
				ariaLabel: bestAria,
			};
		});
	}
	public async extractPanelLinks(
		session: BrowserSession,
	): Promise<import("./types").InlineLink[]> {
		this.logger.info("[chatgpt:extract] extracting panel links");

		// The page.evaluate callback runs inside the browser's JS context,
		// where `this` is `window` — never the provider instance. Return a
		// structured result and log on the Node side instead.
		//
		// We accept every external <a> inside the panel — preferring
		// `ul li > a` (the pattern seen on chatgpt.com today) but falling
		// back to any <a href> in the panel so a future UI tweak doesn't
		// silently break us. The old `target=_blank` / `rel="noopener"`
		// filter is gone — ChatGPT's own panel anchors don't always set
		// those attributes.
		const result = await session.page.evaluate(() => {
			const panel = document.querySelector(
				'[role="dialog"], [data-state="open"]',
			);
			if (!panel) {
				return { panelFound: false, anchorCount: 0, links: [] as unknown[] };
			}

			const all = Array.from(panel.querySelectorAll("a[href]"));
			// Prefer the list-item anchors; fall back to any anchor in panel.
			const listAnchors = panel.querySelectorAll("ul li > a");
			const anchors = listAnchors.length > 0 ? listAnchors : all;

			const seen = new Set<string>();
			const out: Array<{
				title: string;
				url: string;
				domain: string;
				citedText?: string;
				position: number;
			}> = [];
			Array.from(anchors).forEach((a, i) => {
				const href = (a as HTMLAnchorElement).href;
				if (!href) return;
				// de-dupe by href (panel can include the same link twice)
				if (seen.has(href)) return;
				seen.add(href);

				let domain = "";
				try {
					domain = new URL(href).hostname.replace("www.", "");
				} catch {
					return;
				}

				const allTexts = Array.from(a.childNodes)
					.filter(
						(n) =>
							n.nodeType === Node.TEXT_NODE || (n as Element).tagName !== "SUP",
					)
					.map((n) => n.textContent?.trim() ?? "")
					.filter(Boolean);
				const title = allTexts.sort((a, b) => b.length - a.length)[0] ?? "";

				const citedTexts = Array.from(a.querySelectorAll("span, p, div"))
					.map((el) => el.textContent?.trim() ?? "")
					.filter(Boolean);
				const citedText =
					citedTexts.sort((a, b) => b.length - a.length)[0] ?? "";

				out.push({
					title: title || domain,
					url: href,
					domain,
					citedText: citedText && citedText !== title ? citedText : undefined,
					position: i + 1,
				});
			});

			return {
				panelFound: true,
				anchorCount: all.length,
				links: out,
			};
		});

		if (!result.panelFound) {
			this.logger.info("[chatgpt:extract] no sources panel found");
		} else {
			this.logger.info("[chatgpt:extract] found panel", {
				anchorCount: result.anchorCount,
				extractedCount: result.links.length,
			});
		}
		return result.links as import("./types").InlineLink[];
	}

	private async clickSourcesButton(session: BrowserSession): Promise<boolean> {
		return session.page.evaluate(() => {
			const TEXT_RE = /\b\d+\s*sources?\b/i;
			const ARIA_RE = /\bsources?\b/i;
			const responseEls = document.querySelectorAll(
				'[data-message-author-role="assistant"]',
			);
			const lastResp = responseEls[
				responseEls.length - 1
			] as HTMLElement | null;
			const responseBottom = lastResp
				? lastResp.getBoundingClientRect().bottom
				: 0;

			const candidates = document.querySelectorAll(
				'button, [role="button"], a[href]',
			);
			let bestEl: HTMLElement | null = null;
			let bestScore = 0;
			for (const el of candidates) {
				const text = (el.textContent ?? "").trim();
				const ariaLabel = el.getAttribute("aria-label") ?? "";
				const className = el.getAttribute("class") ?? "";
				const rect = el.getBoundingClientRect();
				const isFootnote = className.toLowerCase().includes("footnote");
				const isBelowResponse = lastResp !== null && rect.top > responseBottom;

				let score = 0;
				if (TEXT_RE.test(text)) score += 120;
				if (ARIA_RE.test(ariaLabel)) score += 90;
				if (isFootnote) score += 50;
				if (isBelowResponse) score += 50;

				if (score > bestScore) {
					bestScore = score;
					bestEl = el as HTMLElement;
				}
			}
			if (!bestEl || bestScore < 140) return false;
			bestEl.click();
			return true;
		});
	}

	private async extractFromSourcesPanel(
		session: BrowserSession,
	): Promise<import("./types").InlineLink[]> {
		// The Sources button is added by ChatGPT after the streaming response
		// "stabilises" (waitForResponse), sometimes with a 1-3s delay. Poll
		// for `sourcesPanelPollMs` before giving up — without this we'd miss
		// the button on slow connections and the entire side-panel extraction
		// is skipped, falling back to inline links only.
		const pollTimeoutMs = this.sourcesPanelPollMs;
		const POLL_INTERVAL_MS = 250;
		const pollStart = Date.now();
		let button: Awaited<ReturnType<typeof this.findSourcesButton>> = {
			found: false,
		};
		while (Date.now() - pollStart < pollTimeoutMs) {
			button = await this.findSourcesButton(session);
			if (button.found) break;
			await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
		}

		if (!button.found) {
			this.logger.info(
				"[chatgpt:extract] no sources button found within timeout; falling back to inline links",
				{ pollTimeoutMs },
			);
			return [];
		}

		this.logger.info("[chatgpt:extract] found candidate sources button", {
			score: button.score,
			tag: button.tag,
			text: button.text,
			ariaLabel: button.ariaLabel,
		});

		const opened = await this.clickSourcesButton(session);
		if (!opened) {
			this.logger?.warn("[chatgpt:extract] sources panel not opened");
			return [];
		}
		this.logger.info("[chatgpt:extract] sources panel opened", {
			clicked: opened,
		});

		await session.page.waitForTimeout(500);

		let links: import("./types").InlineLink[] = [];
		try {
			links = await this.extractPanelLinks(session);
		} catch (e) {
			this.logger.info(
				"[chatgpt:extract] ❌ extractPanelLinks threw; will still close panel and rethrow",
				{ error: e instanceof Error ? e.message : String(e) },
			);
			try {
				await this.clickSourcesButton(session);
			} catch {
				// ignore
			}
			throw e;
		}

		const closed = await this.clickSourcesButton(session);
		this.logger.info("[chatgpt:extract] sources panel click (close)", {
			clicked: closed,
			extractedLinks: links.length,
		});

		return links;
	}

	private validateResponse(content: string): string | null {
		const blocklist = [
			"our systems have detected unusual traffic",
			"please verify you're human",
			"too many requests",
			"service is unavailable",
			"sign in to continue",
			"access denied",
			"you've been logged out",
		];
		const lower = content.toLowerCase();
		for (const phrase of blocklist) {
			if (lower.includes(phrase)) return phrase;
		}
		return null;
	}

	async extractResult(session: BrowserSession): Promise<CrawlResult> {
		const startTime = Date.now();
		const maxRetries = 2;
		const backoffMs = [1500, 5000];

		this.logger.info("[chatgpt:extract] start", { maxRetries });

		for (let attempt = 0; attempt <= maxRetries; attempt++) {
			if (attempt > 0) {
				const waitMs = backoffMs[attempt - 1] ?? 5000;
				this.logger.info(
					`[chatgpt:extract] retry ${attempt}/${maxRetries} after ${waitMs}ms`,
				);
				await session.page.waitForTimeout(waitMs);
			}

			const element = await this.findLatestResponseElement(session);
			if (!element) {
				this.logger.info(
					`[chatgpt:extract] ⚠️ no assistant response element (attempt ${attempt + 1})`,
				);
				if (attempt < maxRetries) continue;
				throw new Error("No assistant response element found");
			}

			const content = toMarkdown(element.processedHTML);
			this.logger.info(
				`[chatgpt:extract] parsed content (attempt ${attempt + 1})`,
				{
					contentLength: content.length,
				},
			);

			const blockedPhrase = this.validateResponse(content);
			if (blockedPhrase) {
				this.logger.info(
					`[chatgpt:extract] ⚠️ bot-detection phrase detected (attempt ${attempt + 1}): "${blockedPhrase}"`,
				);
				if (attempt < maxRetries) continue;
				throw new Error(`Bot detection triggered: "${blockedPhrase}"`);
			}

			if (content.trim().length < 50) {
				this.logger.info(
					`[chatgpt:extract] ⚠️ content too short (${content.trim().length} chars, attempt ${attempt + 1})`,
				);
				if (attempt < maxRetries) continue;
				const visibleTextChars = content.trim().length;
				throw new Error(
					`Empty extraction: content too short (${visibleTextChars} chars)`,
				);
			}

			let inlineLinks: InlineLink[] = [];

			try {
				const panelLinks = await this.extractFromSourcesPanel(session);
				if (panelLinks.length > 0) {
					inlineLinks = panelLinks;
					this.logger.info("[chatgpt:extract] using side-panel links", {
						count: panelLinks.length,
					});
				} else {
					inlineLinks = await this.extractInlineLinks(session);
					this.logger.info("[chatgpt:extract] using inline links", {
						count: inlineLinks.length,
					});
				}
			} catch (e) {
				this.logger.info(
					`[chatgpt:extract] ❌ link extraction failed on attempt ${attempt + 1}; falling back to inline links (or empty if that also fails)`,
					{
						error: e instanceof Error ? e.message : String(e),
						stack: e instanceof Error ? e.stack : undefined,
					},
				);
				try {
					inlineLinks = await this.extractInlineLinks(session);
					this.logger.info("[chatgpt:extract] using inline links (fallback)", {
						count: inlineLinks.length,
					});
				} catch (e2) {
					this.logger.info(
						`[chatgpt:extract] ❌ inline-link fallback also failed on attempt ${attempt + 1}`,
						{
							error: e2 instanceof Error ? e2.message : String(e2),
						},
					);
					inlineLinks = [];
				}
			}

			inlineLinks = filterSelfCitations(this.name, inlineLinks);
			const loadTimeMs = Date.now() - startTime;
			this.logger.info("[chatgpt:extract] done", {
				contentLength: content.length,
				inlineLinkCount: inlineLinks.length,
				loadTimeMs,
				url: session.page.url(),
			});
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
				structured: {
					citations: [],
					brandMentions: [],
					inlineLinks,
				},
			};
		}

		throw new Error("Extraction failed after retries");
	}

	classifyError(error: Error): FailureType {
		const msg = error.message.toLowerCase();
		const causeMsg =
			error.cause instanceof Error
				? error.cause.message.toLowerCase()
				: typeof error.cause === "string"
					? error.cause.toLowerCase()
					: "";
		const combined = `${msg} ${causeMsg}`;

		if (
			combined.includes("prosemirror editor") &&
			combined.includes("not found")
		)
			return "no_editor";
		if (combined.includes("google sign-in")) return "logged_out";
		if (combined.includes("response stability timeout")) return "timeout";

		return "unknown";
	}
}
