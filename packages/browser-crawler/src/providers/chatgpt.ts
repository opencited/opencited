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

	async submitQuery(_session: BrowserSession, _query: string): Promise<void> {
		throw new Error("Not implemented yet");
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
