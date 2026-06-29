import type { BrowserSession } from "../types";
import type { CrawlerProvider } from "./base";
import type { CrawlResult } from "./types";
import type { FailureType } from "../errors";

const AUTH_MODAL_SELECTOR = '[role="dialog"][data-state="open"]';
const AUTH_MODAL_TEXT_RE = /Thanks for trying ChatGPT|Log in or sign up/i;
const STAY_LOGGED_OUT_RE = /^Stay logged out$/i;

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

	private async dismissAuthModal(
		session: BrowserSession,
		timeoutMs: number,
	): Promise<void> {
		const dialog = await session.page.evaluate(
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

		if (!dialog) return;

		await session.page.waitForTimeout(timeoutMs);

		const clicked = await session.page.evaluate(
			({ buttonRe }) => {
				const buttons = document.querySelectorAll("button");
				for (const btn of buttons) {
					if (new RegExp(buttonRe).test(btn.textContent?.trim() ?? "")) {
						(btn as HTMLElement).click();
						return true;
					}
				}
				return false;
			},
			{ buttonRe: STAY_LOGGED_OUT_RE.source },
		);

		if (!clicked) {
			const fallback = await session.page.evaluate(
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
			if (!fallback) {
				throw new Error(
					"Auth modal detected but 'Stay logged out' button not found and dialog could not be removed",
				);
			}
		}
	}

	async beforePrompt(session: BrowserSession, _query: string): Promise<void> {
		await this.dismissAuthModal(session, 500);
	}

	async afterTyping(session: BrowserSession, _query: string): Promise<void> {
		await this.dismissAuthModal(session, 1500);
	}

	async beforeSubmit(session: BrowserSession, _query: string): Promise<void> {
		await this.dismissAuthModal(session, 1500);
	}

	async afterSubmit(session: BrowserSession, _query: string): Promise<void> {
		await this.dismissAuthModal(session, 1500);
	}

	async navigate(session: BrowserSession): Promise<void> {
		await session.page.goto("https://chatgpt.com/", {
			waitUntil: "load",
		});
	}

	private randomBetween(min: number, max: number): number {
		return Math.floor(Math.random() * (max - min + 1)) + min;
	}

	private async typeWithHumanDelay(
		session: BrowserSession,
		query: string,
	): Promise<void> {
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

		let pos = 0;
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

			if (chunksSincePause >= pauseEvery && pos + chunkSize < query.length) {
				const pauseMs = this.randomBetween(120, 260);
				await session.page.waitForTimeout(pauseMs);
				chunksSincePause = 0;
			} else if (pos + chunkSize < query.length) {
				const delayMs = this.randomBetween(delayMin, delayMax);
				await session.page.waitForTimeout(delayMs);
			}

			pos += chunkSize;
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
		const strategies: Array<() => Promise<boolean>> = [
			async () => {
				await session.page.keyboard.press("Enter");
				await session.page.waitForTimeout(200);
				return this.verifySubmissionSuccess(session);
			},
			async () => {
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

		for (const strategy of strategies) {
			const success = await strategy();
			if (success) return;
		}

		throw new Error(
			"All submission strategies failed — submission_failed: Enter key, native click, force dispatch, and dispatch event all failed to submit the query",
		);
	}

	async submitQuery(session: BrowserSession, query: string): Promise<void> {
		this.initialUrl = session.page.url();

		const proseMirrorFound = await session.page.evaluate(() => {
			const editor = document.querySelector(
				"#prompt-textarea.ProseMirror",
			) as HTMLElement | null;
			if (!editor) return false;
			editor.click();
			return true;
		});

		if (!proseMirrorFound) {
			const currentUrl = session.page.url();
			const pageTitle = await session.page.title();
			throw new Error(
				`ProseMirror editor #prompt-textarea not found. URL: ${currentUrl}, Title: "${pageTitle}"`,
			);
		}

		const { delayMin, delayMax } = PROVIDER_TIMINGS.click;
		const clickDelay = this.randomBetween(delayMin, delayMax);
		await session.page.waitForTimeout(clickDelay);

		await this.typeWithHumanDelay(session, query);
		await this.submitWithFallback(session);
	}

	async waitForResponse(_session: BrowserSession): Promise<void> {
		throw new Error("Not implemented yet");
	}

	async extractResult(_session: BrowserSession): Promise<CrawlResult> {
		throw new Error("Not implemented yet");
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
