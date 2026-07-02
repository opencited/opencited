import { describe, expect, it, mock } from "bun:test";
import { ChatGPTProvider } from "../src/providers/chatgpt";
import type { BrowserSession } from "../src/types";

function createMockSession(
	options: {
		pollSequence?: Array<{
			textLength: number;
			innerHTMLLen: number;
			childCount: number;
			textTail: string;
			stopVisible: boolean;
			stopText: string;
			stopAriaLabel: string;
			stopDisabled: boolean;
		}>;
	} = {},
): BrowserSession {
	const { pollSequence = [] } = options;

	const waitForTimeoutCalls: number[] = [];
	const evaluateCalls: string[] = [];
	let pollIndex = 0;

	const fakePage = {
		url: () => "https://chatgpt.com/",
		title: () => Promise.resolve("ChatGPT"),
		goto: mock(async () => {}),
		waitForLoadState: mock(async (_state?: string) => {}),
		waitForTimeout: mock(async (ms: number) => {
			waitForTimeoutCalls.push(ms);
		}),
		keyboard: {
			type: mock(async () => {}),
			press: mock(async () => {}),
		},
		click: mock(async () => {}),
		evaluate: mock(
			async (
				fnOrFn: ((...args: unknown[]) => unknown) | string,
				_args?: unknown,
			) => {
				const fnStr = typeof fnOrFn === "function" ? fnOrFn.toString() : fnOrFn;
				evaluateCalls.push(fnStr);

				// waitForResponse polling: checks stop button + response element
				if (
					fnStr.includes("stop-button") ||
					fnStr.includes("data-message-author-role")
				) {
					const poll =
						pollIndex < pollSequence.length
							? pollSequence[pollIndex]
							: pollSequence[pollSequence.length - 1];
					if (poll && pollIndex < pollSequence.length) {
						pollIndex++;
					}
					return Promise.resolve({
						textLength: poll?.textLength ?? 0,
						innerHTMLLen: poll?.innerHTMLLen ?? 0,
						childCount: poll?.childCount ?? 0,
						textTail: poll?.textTail ?? "",
						stopVisible: poll?.stopVisible ?? false,
						stopText: poll?.stopText ?? "",
						stopAriaLabel: poll?.stopAriaLabel ?? "",
						stopDisabled: poll?.stopDisabled ?? false,
					});
				}

				return Promise.resolve(false);
			},
		),
	};

	return {
		browser: {} as never,
		context: {} as never,
		page: fakePage as never,
		_getState: () => ({
			waitForTimeoutCalls,
			evaluateCalls,
			pollIndex,
		}),
	} as unknown as BrowserSession & {
		_getState: () => {
			waitForTimeoutCalls: number[];
			evaluateCalls: string[];
			pollIndex: number;
		};
	};
}

describe("ChatGPTProvider.waitForResponse", () => {
	it("polls at ~300ms intervals with jitter", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			pollSequence: [
				{
					textLength: 0,
					innerHTMLLen: 0,
					childCount: 0,
					textTail: "",
					stopVisible: true,
					stopText: "Stop",
					stopAriaLabel: "Stop generating",
					stopDisabled: false,
				},
				{
					textLength: 50,
					innerHTMLLen: 200,
					childCount: 3,
					textTail: "Hello world",
					stopVisible: false,
					stopText: "",
					stopAriaLabel: "",
					stopDisabled: false,
				},
			],
		}) as BrowserSession & {
			_getState: () => {
				waitForTimeoutCalls: number[];
				evaluateCalls: string[];
			};
		};

		await (provider as any).waitForResponse(session);

		const state = session._getState();
		const pollTimeouts = state.waitForTimeoutCalls.filter(
			(ms) => ms >= 250 && ms <= 350,
		);
		expect(pollTimeouts.length).toBeGreaterThanOrEqual(1);
	});

	it("completes when content is stable (no stop button + 1.5s stable)", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			pollSequence: [
				{
					textLength: 100,
					innerHTMLLen: 500,
					childCount: 5,
					textTail: "TypeScript is a typed superset of JavaScript",
					stopVisible: true,
					stopText: "Stop",
					stopAriaLabel: "Stop generating",
					stopDisabled: false,
				},
				{
					textLength: 200,
					innerHTMLLen: 800,
					childCount: 7,
					textTail: "that compiles to plain JavaScript.",
					stopVisible: true,
					stopText: "Stop",
					stopAriaLabel: "Stop generating",
					stopDisabled: false,
				},
				{
					textLength: 200,
					innerHTMLLen: 800,
					childCount: 7,
					textTail: "that compiles to plain JavaScript.",
					stopVisible: false,
					stopText: "",
					stopAriaLabel: "",
					stopDisabled: false,
				},
				{
					textLength: 200,
					innerHTMLLen: 800,
					childCount: 7,
					textTail: "that compiles to plain JavaScript.",
					stopVisible: false,
					stopText: "",
					stopAriaLabel: "",
					stopDisabled: false,
				},
			],
		}) as BrowserSession & {
			_getState: () => {
				waitForTimeoutCalls: number[];
				evaluateCalls: string[];
			};
		};

		await (provider as any).waitForResponse(session);

		const state = session._getState();
		expect(state.evaluateCalls.length).toBeGreaterThanOrEqual(3);
	});

	it("resets stable timer when response signature changes mid-stream", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			pollSequence: [
				{
					textLength: 50,
					innerHTMLLen: 200,
					childCount: 2,
					textTail: "Hello",
					stopVisible: true,
					stopText: "Stop",
					stopAriaLabel: "Stop generating",
					stopDisabled: false,
				},
				{
					textLength: 100,
					innerHTMLLen: 400,
					childCount: 3,
					textTail: "Hello world",
					stopVisible: true,
					stopText: "Stop",
					stopAriaLabel: "Stop generating",
					stopDisabled: false,
				},
				{
					textLength: 150,
					innerHTMLLen: 600,
					childCount: 4,
					textTail: "Hello world how are you",
					stopVisible: true,
					stopText: "Stop",
					stopAriaLabel: "Stop generating",
					stopDisabled: false,
				},
				{
					textLength: 150,
					innerHTMLLen: 600,
					childCount: 4,
					textTail: "Hello world how are you",
					stopVisible: false,
					stopText: "",
					stopAriaLabel: "",
					stopDisabled: false,
				},
				{
					textLength: 150,
					innerHTMLLen: 600,
					childCount: 4,
					textTail: "Hello world how are you",
					stopVisible: false,
					stopText: "",
					stopAriaLabel: "",
					stopDisabled: false,
				},
			],
		}) as BrowserSession & {
			_getState: () => {
				evaluateCalls: string[];
			};
		};

		await (provider as any).waitForResponse(session);

		const state = session._getState();
		expect(state.evaluateCalls.length).toBeGreaterThanOrEqual(5);
	});

	it("resets stable timer when generation signature changes", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			pollSequence: [
				{
					textLength: 100,
					innerHTMLLen: 400,
					childCount: 3,
					textTail: "Some text",
					stopVisible: true,
					stopText: "Stop",
					stopAriaLabel: "Stop generating",
					stopDisabled: false,
				},
				{
					textLength: 100,
					innerHTMLLen: 400,
					childCount: 3,
					textTail: "Some text",
					stopVisible: true,
					stopText: "Stop",
					stopAriaLabel: "Stop generating",
					stopDisabled: true,
				},
				{
					textLength: 100,
					innerHTMLLen: 400,
					childCount: 3,
					textTail: "Some text",
					stopVisible: false,
					stopText: "",
					stopAriaLabel: "",
					stopDisabled: false,
				},
				{
					textLength: 100,
					innerHTMLLen: 400,
					childCount: 3,
					textTail: "Some text",
					stopVisible: false,
					stopText: "",
					stopAriaLabel: "",
					stopDisabled: false,
				},
			],
		}) as BrowserSession & {
			_getState: () => {
				evaluateCalls: string[];
			};
		};

		await (provider as any).waitForResponse(session);

		const state = session._getState();
		expect(state.evaluateCalls.length).toBeGreaterThanOrEqual(4);
	});

	it("force-exits after 45s even if stop button never disappears", async () => {
		const provider = new ChatGPTProvider();
		const alwaysStreaming = {
			textLength: 50,
			innerHTMLLen: 200,
			childCount: 2,
			textTail: "partial response...",
			stopVisible: true,
			stopText: "Stop",
			stopAriaLabel: "Stop generating",
			stopDisabled: false,
		};
		const pollSequence = Array.from({ length: 155 }, () => alwaysStreaming);

		const session = createMockSession({
			pollSequence,
		}) as BrowserSession & {
			_getState: () => {
				evaluateCalls: string[];
			};
		};

		await (provider as any).waitForResponse(session);

		const state = session._getState();
		expect(state.evaluateCalls.length).toBeGreaterThanOrEqual(150);
	});

	it("returns without error when content stable from the start", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			pollSequence: [
				{
					textLength: 150,
					innerHTMLLen: 600,
					childCount: 4,
					textTail: "Some completed response text",
					stopVisible: false,
					stopText: "",
					stopAriaLabel: "",
					stopDisabled: false,
				},
				{
					textLength: 150,
					innerHTMLLen: 600,
					childCount: 4,
					textTail: "Some completed response text",
					stopVisible: false,
					stopText: "",
					stopAriaLabel: "",
					stopDisabled: false,
				},
				{
					textLength: 150,
					innerHTMLLen: 600,
					childCount: 4,
					textTail: "Some completed response text",
					stopVisible: false,
					stopText: "",
					stopAriaLabel: "",
					stopDisabled: false,
				},
			],
		}) as BrowserSession;

		await expect(
			(provider as any).waitForResponse(session),
		).resolves.toBeUndefined();
	});
});
