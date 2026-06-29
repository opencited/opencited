import { describe, expect, it, mock } from "bun:test";
import { ChatGPTProvider, PROVIDER_TIMINGS } from "../src/providers/chatgpt";
import type { BrowserSession } from "../src/types";

function createMockSession(
	options: {
		proseMirrorFound?: boolean;
		inputCleared?: boolean;
		urlChanged?: boolean;
		inputHidden?: boolean;
		sendButtonFound?: boolean;
	} = {},
): BrowserSession {
	const {
		proseMirrorFound = true,
		inputCleared = false,
		urlChanged = false,
		inputHidden = false,
		sendButtonFound = true,
	} = options;

	const keyboardCalls: Array<{ method: string; args: unknown[] }> = [];
	const evaluateCalls: Array<{ fn: string; args: unknown }> = [];
	const waitForTimeoutCalls: number[] = [];
	const clickCalls: string[] = [];
	let currentUrl = "https://chatgpt.com/";

	const fakePage = {
		url: () => currentUrl,
		setUrl: (url: string) => {
			currentUrl = url;
		},
		title: () => Promise.resolve("ChatGPT"),
		goto: mock((_url: string, _opts?: unknown) => Promise.resolve()),
		waitForTimeout: mock(async (ms: number) => {
			waitForTimeoutCalls.push(ms);
		}),
		keyboard: {
			type: mock(async (text: string) => {
				keyboardCalls.push({ method: "type", args: [text] });
			}),
			press: mock(async (key: string) => {
				keyboardCalls.push({ method: "press", args: [key] });
			}),
		},
		click: mock(async (selector: string) => {
			clickCalls.push(selector);
		}),
		evaluate: mock(
			async (
				fnOrFn: ((...args: unknown[]) => unknown) | string,
				args?: unknown,
			) => {
				const fnStr = typeof fnOrFn === "function" ? fnOrFn.toString() : fnOrFn;
				evaluateCalls.push({ fn: fnStr, args });

				// Verification check in verifySubmissionSuccess - returns { inputCleared, urlChanged, inputHidden }
				if (
					fnStr.includes("inputCleared") &&
					fnStr.includes("urlChanged") &&
					fnStr.includes("inputHidden")
				) {
					return Promise.resolve({ inputCleared, urlChanged, inputHidden });
				}

				// Double-check after verification - just checks textContent (no inputCleared variable)
				// Returns boolean: true if editor is empty, false otherwise
				if (
					fnStr.includes("textContent") &&
					fnStr.includes("trim") &&
					!fnStr.includes("inputCleared") &&
					!fnStr.includes("prompt-textarea")
				) {
					return Promise.resolve(inputCleared);
				}

				// submitQuery focus: clicks editor and returns boolean
				if (
					fnStr.includes("prompt-textarea") &&
					fnStr.includes("ProseMirror") &&
					fnStr.includes("editor.click()")
				) {
					return Promise.resolve(proseMirrorFound);
				}

				// submitWithFallback strategies: KeyboardEvent or InputEvent dispatch
				if (
					fnStr.includes("prompt-textarea") &&
					fnStr.includes("ProseMirror") &&
					(fnStr.includes("KeyboardEvent") || fnStr.includes("InputEvent"))
				) {
					return Promise.resolve(proseMirrorFound);
				}

				// Send button check for native click strategy
				if (fnStr.includes("send-button") || fnStr.includes("Send prompt")) {
					return Promise.resolve(sendButtonFound);
				}

				return Promise.resolve(false);
			},
		),
		dispatchEvent: mock(async (_type: string) => {}),
	};

	return {
		browser: {} as never,
		context: {} as never,
		page: fakePage as never,
		_getState: () => ({
			keyboardCalls,
			evaluateCalls,
			waitForTimeoutCalls,
			clickCalls,
			currentUrl,
		}),
	} as unknown as BrowserSession & {
		_getState: () => {
			keyboardCalls: typeof keyboardCalls;
			evaluateCalls: typeof evaluateCalls;
			waitForTimeoutCalls: typeof waitForTimeoutCalls;
			clickCalls: typeof clickCalls;
			currentUrl: string;
		};
		_page: typeof fakePage;
	};
}

describe("ChatGPTProvider.typeWithHumanDelay", () => {
	it("types text using keyboard.type in grapheme chunks", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession() as BrowserSession & {
			_getState: () => {
				keyboardCalls: Array<{ method: string; args: unknown[] }>;
			};
		};

		await (provider as any).typeWithHumanDelay(session, "Hello world");

		const state = session._getState();
		const typeCalls = state.keyboardCalls.filter((c) => c.method === "type");
		expect(typeCalls.length).toBeGreaterThan(0);

		const totalTyped = typeCalls.reduce(
			(sum, c) => sum + (c.args[0] as string).length,
			0,
		);
		expect(totalTyped).toBe(11);
	});

	it("uses grapheme chunks between 3-8 characters", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession() as BrowserSession & {
			_getState: () => {
				keyboardCalls: Array<{ method: string; args: unknown[] }>;
			};
		};

		await (provider as any).typeWithHumanDelay(session, "a".repeat(50));

		const state = session._getState();
		const typeCalls = state.keyboardCalls.filter((c) => c.method === "type");

		for (let i = 0; i < typeCalls.length; i++) {
			const chunkLen = (typeCalls[i].args[0] as string).length;
			const isLastChunk = i === typeCalls.length - 1;
			if (isLastChunk) {
				expect(chunkLen).toBeGreaterThanOrEqual(1);
				expect(chunkLen).toBeLessThanOrEqual(PROVIDER_TIMINGS.typing.chunkMax);
			} else {
				expect(chunkLen).toBeGreaterThanOrEqual(
					PROVIDER_TIMINGS.typing.chunkMin,
				);
				expect(chunkLen).toBeLessThanOrEqual(PROVIDER_TIMINGS.typing.chunkMax);
			}
		}
	});

	it("inserts think-pauses every 22-40 chunks", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession() as BrowserSession & {
			_getState: () => {
				keyboardCalls: Array<{ method: string; args: unknown[] }>;
				waitForTimeoutCalls: number[];
			};
		};

		await (provider as any).typeWithHumanDelay(session, "a".repeat(400));

		const state = session._getState();
		const typeCalls = state.keyboardCalls.filter((c) => c.method === "type");
		const pauseCalls = state.waitForTimeoutCalls.filter(
			(ms) => ms >= 120 && ms <= 260,
		);

		expect(typeCalls.length).toBeGreaterThan(40);
		expect(pauseCalls.length).toBeGreaterThanOrEqual(1);
	});
});

describe("ChatGPTProvider.submitWithFallback", () => {
	it("tries Enter key first and succeeds", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			inputCleared: true,
		}) as BrowserSession & {
			_getState: () => {
				keyboardCalls: Array<{ method: string; args: unknown[] }>;
			};
		};

		await (provider as any).submitWithFallback(session);

		const state = session._getState();
		const pressCalls = state.keyboardCalls.filter((c) => c.method === "press");
		expect(pressCalls.some((c) => c.args[0] === "Enter")).toBe(true);
	});

	it("falls back to native click when Enter fails", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			inputCleared: false,
			sendButtonFound: true,
		}) as BrowserSession & {
			_getState: () => {
				keyboardCalls: Array<{ method: string; args: unknown[] }>;
				evaluateCalls: Array<{ fn: string; args: unknown }>;
			};
		};

		// Enter will fail (inputCleared: false), but native click's evaluate returns true
		// The verification after native click also returns false, so it falls through
		// We just verify Enter was tried and send-button evaluate was called
		try {
			await (provider as any).submitWithFallback(session);
		} catch {
			// Expected to throw since all strategies ultimately fail verification
		}

		const state = session._getState();
		const pressCalls = state.keyboardCalls.filter((c) => c.method === "press");
		expect(pressCalls.some((c) => c.args[0] === "Enter")).toBe(true);

		const evaluateCalls = state.evaluateCalls;
		expect(
			evaluateCalls.some(
				(c) => c.fn.includes("send-button") || c.fn.includes("Send prompt"),
			),
		).toBe(true);
	});

	it("throws submission_failed when all strategies fail", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			inputCleared: false,
			sendButtonFound: false,
		}) as BrowserSession;

		await expect((provider as any).submitWithFallback(session)).rejects.toThrow(
			/submission.*failed|all.*strategies/i,
		);
	});
});

describe("ChatGPTProvider.verifySubmissionSuccess", () => {
	it("returns true when input is cleared", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			inputCleared: true,
		}) as BrowserSession;

		const result = await (provider as any).verifySubmissionSuccess(session);
		expect(result).toBe(true);
	});

	it("returns true when URL changed", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			urlChanged: true,
		}) as BrowserSession;

		const result = await (provider as any).verifySubmissionSuccess(session);
		expect(result).toBe(true);
	});

	it("returns true when input is hidden", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			inputHidden: true,
		}) as BrowserSession;

		const result = await (provider as any).verifySubmissionSuccess(session);
		expect(result).toBe(true);
	});

	it("returns false when none of the conditions are met", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			inputCleared: false,
			urlChanged: false,
			inputHidden: false,
		}) as BrowserSession;

		const result = await (provider as any).verifySubmissionSuccess(session);
		expect(result).toBe(false);
	});
});

describe("ChatGPTProvider.submitQuery", () => {
	it("clicks ProseMirror div to focus before typing", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			proseMirrorFound: true,
			inputCleared: true,
		}) as BrowserSession & {
			_getState: () => {
				evaluateCalls: Array<{ fn: string; args: unknown }>;
			};
		};

		await provider.submitQuery(session, "test query");

		const state = session._getState();
		expect(
			state.evaluateCalls.some(
				(c) =>
					c.fn.includes("prompt-textarea") &&
					c.fn.includes("ProseMirror") &&
					c.fn.includes("editor.click()"),
			),
		).toBe(true);
	});

	it("throws when ProseMirror editor is not found", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			proseMirrorFound: false,
		}) as BrowserSession;

		await expect(provider.submitQuery(session, "test query")).rejects.toThrow(
			/prosemirror editor.*not found|no.*editor/i,
		);
	});

	it("types the query and submits", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			proseMirrorFound: true,
			inputCleared: true,
		}) as BrowserSession & {
			_getState: () => {
				keyboardCalls: Array<{ method: string; args: unknown[] }>;
			};
		};

		await provider.submitQuery(session, "What is TypeScript?");

		const state = session._getState();
		const typeCalls = state.keyboardCalls.filter((c) => c.method === "type");
		expect(typeCalls.length).toBeGreaterThan(0);

		const allText = typeCalls.map((c) => c.args[0]).join("");
		expect(allText).toContain("What is TypeScript?");
	});
});
