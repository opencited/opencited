import { describe, expect, it, mock } from "bun:test";
import { PerplexityProvider } from "../src/providers/perplexity";
import type { BrowserSession } from "../src/types";

function createMockSession(options: {
	loginModalPresent?: boolean;
	navigateOnEnter?: boolean;
}): BrowserSession {
	const { loginModalPresent = false, navigateOnEnter = true } = options;
	let modalPresent = loginModalPresent;
	let url = "https://www.perplexity.ai/";

	const locator = {
		first: () => locator,
		waitFor: mock(async () => {}),
		click: mock(async () => {}),
		fill: mock(async () => {}),
		focus: mock(async () => {}),
		press: mock(async () => {
			if (navigateOnEnter) {
				url = "https://www.perplexity.ai/search/test-id";
			}
		}),
	};

	const fakePage = {
		url: () => url,
		waitForLoadState: mock(async () => {}),
		waitForTimeout: mock(async () => {}),
		waitForURL: mock(async (pattern: RegExp | string) => {
			if (navigateOnEnter && String(pattern).includes("search")) {
				url = "https://www.perplexity.ai/search/test-id";
			}
		}),
		waitForSelector: mock(async () => {}),
		locator: mock(() => locator),
		keyboard: {
			press: mock(async () => {}),
			insertText: mock(async () => {}),
		},
		mouse: { click: mock(async () => {}) },
		title: () => Promise.resolve("Perplexity"),
		evaluate: mock(
			async (fnOrFn: (() => unknown) | string, _args?: unknown) => {
				const fnStr =
					typeof fnOrFn === "function" ? fnOrFn.toString() : String(fnOrFn);

				if (fnStr.includes("el.remove()")) {
					modalPresent = false;
					return Promise.resolve(true);
				}
				if (
					fnStr.includes("overlaySelector") &&
					fnStr.includes("headingRe") &&
					!fnStr.includes("removed = false")
				) {
					return Promise.resolve(modalPresent);
				}
				if (
					fnStr.includes("HTMLTextAreaElement.prototype") ||
					fnStr.includes("descriptor")
				) {
					return Promise.resolve(true);
				}
				if (fnStr.includes("heuristic-bottom-composer")) {
					return Promise.resolve({ ok: true, matched: "#ask-input" });
				}
				if (
					fnStr.includes('querySelector("#ask-input")') &&
					fnStr.includes("el.value")
				) {
					return Promise.resolve("test query");
				}
				if (fnStr.includes("requestSubmit")) {
					url = "https://www.perplexity.ai/search/test-id";
					return Promise.resolve(true);
				}
				if (
					fnStr.includes("isToolbarLabelButton") ||
					fnStr.includes("candidates")
				) {
					url = "https://www.perplexity.ai/search/test-id";
					return Promise.resolve(true);
				}
				if (fnStr.includes("googleRe") && fnStr.includes("headingRe")) {
					return Promise.resolve(false);
				}
				if (fnStr.includes("got it")) {
					return Promise.resolve(false);
				}
				return Promise.resolve(false);
			},
		),
	};

	return {
		browser: {} as never,
		context: {} as never,
		page: fakePage as never,
	} as BrowserSession;
}

describe("PerplexityProvider.submitQuery", () => {
	it("dismisses login modal before filling and navigates to search", async () => {
		const provider = new PerplexityProvider();
		const session = createMockSession({ loginModalPresent: true });

		await provider.submitQuery(session, "test query");

		const page = session.page as {
			keyboard: { press: ReturnType<typeof mock> };
			waitForURL: ReturnType<typeof mock>;
		};
		expect(page.waitForURL.mock.calls.length).toBeGreaterThan(0);
	});
});
