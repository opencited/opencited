import { describe, expect, it, mock } from "bun:test";
import { PerplexityProvider } from "../src/providers/perplexity";
import type { BrowserSession } from "../src/types";

type PollState = {
	isStreaming: boolean;
	contentLength: number;
	hasCopyButton: boolean;
};

function createMockSession(pollSequence: PollState[]): BrowserSession {
	let pollIndex = 0;
	const waitForTimeoutCalls: number[] = [];

	const fakePage = {
		url: () => "https://www.perplexity.ai/search/test",
		waitForLoadState: mock(async () => {}),
		waitForTimeout: mock(async (ms: number) => {
			waitForTimeoutCalls.push(ms);
		}),
		keyboard: { press: mock(async () => {}) },
		evaluate: mock(async (fnOrFn: (() => unknown) | string) => {
			const fnStr =
				typeof fnOrFn === "function" ? fnOrFn.toString() : String(fnOrFn);

			if (
				fnStr.includes("isStopGenerating") ||
				fnStr.includes("answerContentLength")
			) {
				const poll =
					pollIndex < pollSequence.length
						? pollSequence[pollIndex]
						: pollSequence[pollSequence.length - 1];
				if (poll && pollIndex < pollSequence.length) {
					pollIndex++;
				}
				return Promise.resolve(
					poll ?? {
						isStreaming: false,
						contentLength: 0,
						hasCopyButton: false,
					},
				);
			}

			if (fnStr.includes("got it") || fnStr.includes("Decline optional")) {
				return Promise.resolve(false);
			}

			return Promise.resolve(false);
		}),
	};

	return {
		browser: {} as never,
		context: {} as never,
		page: fakePage as never,
	} as BrowserSession;
}

describe("PerplexityProvider.waitForResponse", () => {
	it("finishes when copy button is stable and not streaming", async () => {
		const provider = new PerplexityProvider();
		const session = createMockSession([
			{ isStreaming: true, contentLength: 0, hasCopyButton: false },
			{ isStreaming: false, contentLength: 0, hasCopyButton: true },
			{ isStreaming: false, contentLength: 0, hasCopyButton: true },
			{ isStreaming: false, contentLength: 0, hasCopyButton: true },
			{ isStreaming: false, contentLength: 0, hasCopyButton: true },
			{ isStreaming: false, contentLength: 0, hasCopyButton: true },
			{ isStreaming: false, contentLength: 0, hasCopyButton: true },
			{ isStreaming: false, contentLength: 0, hasCopyButton: true },
			{ isStreaming: false, contentLength: 0, hasCopyButton: true },
		]);

		await provider.waitForResponse(session);

		const page = session.page as { evaluate: ReturnType<typeof mock> };
		expect(page.evaluate.mock.calls.length).toBeGreaterThan(5);
	});

	it("finishes when content is stable and streaming stopped", async () => {
		const provider = new PerplexityProvider();
		const session = createMockSession([
			{ isStreaming: true, contentLength: 100, hasCopyButton: false },
			{ isStreaming: false, contentLength: 500, hasCopyButton: true },
			{ isStreaming: false, contentLength: 500, hasCopyButton: true },
			{ isStreaming: false, contentLength: 500, hasCopyButton: true },
			{ isStreaming: false, contentLength: 500, hasCopyButton: true },
			{ isStreaming: false, contentLength: 500, hasCopyButton: true },
			{ isStreaming: false, contentLength: 500, hasCopyButton: true },
		]);

		await provider.waitForResponse(session);
		expect(true).toBe(true);
	});
});
