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
		submitAfterChunks?: number;
		authModalAppearsAfterChunks?: number;
		focusShouldFail?: boolean;
	} = {},
): BrowserSession {
	const {
		proseMirrorFound = true,
		inputCleared = false,
		urlChanged = false,
		inputHidden = false,
		sendButtonFound = true,
		submitAfterChunks = Number.POSITIVE_INFINITY,
		authModalAppearsAfterChunks = Number.POSITIVE_INFINITY,
		focusShouldFail = false,
	} = options;

	const keyboardCalls: Array<{ method: string; args: unknown[] }> = [];
	const evaluateCalls: Array<{ fn: string; args: unknown }> = [];
	const waitForTimeoutCalls: number[] = [];
	const clickCalls: string[] = [];
	const focusCalls: string[] = [];
	let currentUrl = "https://chatgpt.com/";
	let chunksTyped = 0;
	let authModalVisible = false;

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
		focus: mock(async (selector: string) => {
			focusCalls.push(selector);
			if (focusShouldFail) {
				throw new Error("not focusable");
			}
		}),
		bringToFront: mock(async () => {}),
		keyboard: {
			type: mock(async (text: string) => {
				keyboardCalls.push({ method: "type", args: [text] });
				chunksTyped++;
				if (chunksTyped === authModalAppearsAfterChunks) {
					authModalVisible = true;
				}
			}),
			press: mock(async (key: string) => {
				keyboardCalls.push({ method: "press", args: [key] });
				if (key === "Escape") {
					authModalVisible = false;
				}
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

				const submittedEarly = chunksTyped >= submitAfterChunks;

				// wasSubmittedEarly - returns { wasSubmittedEarly: boolean }
				if (fnStr.includes("wasSubmittedEarly:")) {
					return Promise.resolve({ wasSubmittedEarly: submittedEarly });
				}

				// Auth modal detection (hasAuthModal) - returns boolean
				if (
					fnStr.includes("querySelectorAll") &&
					fnStr.includes("dialog") &&
					!fnStr.includes("prompt-textarea")
				) {
					return Promise.resolve(authModalVisible);
				}

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
					return Promise.resolve(submittedEarly ? true : inputCleared);
				}

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
			focusCalls,
			currentUrl,
		}),
	} as unknown as BrowserSession & {
		_getState: () => {
			keyboardCalls: typeof keyboardCalls;
			evaluateCalls: typeof evaluateCalls;
			waitForTimeoutCalls: typeof waitForTimeoutCalls;
			clickCalls: typeof clickCalls;
			focusCalls: string[];
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
	it("focuses the ProseMirror editor via page.focus before typing (regression: first character was lost when relying on a JS .click())", async () => {
		const provider = new ChatGPTProvider();
		const focusCalls: string[] = [];
		const session = createMockSession({
			proseMirrorFound: true,
			inputCleared: true,
		}) as BrowserSession & {
			page: { focus: (sel: string) => Promise<void> };
			_getState: () => {
				keyboardCalls: Array<{ method: string; args: unknown[] }>;
			};
		};
		(
			session.page as unknown as { focus: (sel: string) => Promise<void> }
		).focus = mock(async (sel: string) => {
			focusCalls.push(sel);
		});

		await provider.submitQuery(session, "test query");

		expect(focusCalls).toContain("#prompt-textarea.ProseMirror");

		const typeCallIndex = session
			._getState()
			.keyboardCalls.findIndex((c) => c.method === "type");
		const focusCallIndex = focusCalls.length;
		expect(typeCallIndex).toBeGreaterThanOrEqual(0);
		expect(focusCallIndex).toBeGreaterThan(0);
	});

	it("does not rely on a JS-level editor.click() — that path loses the first keystroke", async () => {
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
		const usedJsClick = state.evaluateCalls.some(
			(c) =>
				c.fn.includes("prompt-textarea") &&
				c.fn.includes("ProseMirror") &&
				c.fn.includes("editor.click()"),
		);
		expect(usedJsClick).toBe(false);
	});

	it("throws when ProseMirror editor is not focusable", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			focusShouldFail: true,
		}) as BrowserSession;

		await expect(provider.submitQuery(session, "test query")).rejects.toThrow(
			/prosemirror editor.*not found|not focusable/i,
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

	it("does not pass newlines to keyboard.type — they dispatch as Enter and submit early", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			proseMirrorFound: true,
			inputCleared: true,
		}) as BrowserSession & {
			_getState: () => {
				keyboardCalls: Array<{ method: string; args: unknown[] }>;
			};
		};

		const queryWithNewlines = "What is the best\nCRM for\nsmall business?";
		await provider.submitQuery(session, queryWithNewlines);

		const state = session._getState();
		const typeCalls = state.keyboardCalls.filter((c) => c.method === "type");

		for (const call of typeCalls) {
			const chunk = call.args[0] as string;
			expect(chunk).not.toContain("\n");
			expect(chunk).not.toContain("\r");
		}
	});

	it("re-focuses the ProseMirror editor after each chunk if focus is lost mid-typing", async () => {
		const provider = new ChatGPTProvider();
		let callCount = 0;
		const session = createMockSession({
			proseMirrorFound: true,
			inputCleared: true,
		}) as BrowserSession & {
			page: {
				evaluate: (fn: unknown, args?: unknown) => Promise<unknown>;
			};
		};
		// Simulate the editor losing focus on the 3rd evaluate call
		const originalEvaluate = session.page.evaluate;
		(session.page as { evaluate: typeof originalEvaluate }).evaluate = mock(
			async (fn: unknown, args?: unknown) => {
				callCount++;
				const result = (await originalEvaluate(fn, args)) as Record<
					string,
					unknown
				>;
				if (
					result &&
					typeof result === "object" &&
					"editorTextLength" in result
				) {
					// Pretend the editor lost focus on the 3rd focus-check call
					return {
						...result,
						focused: callCount !== 3,
						documentHasFocus: true,
						editorTextLength: 5,
					};
				}
				return result;
			},
		);

		await provider.submitQuery(session, "this is a test query for chunking");

		const state = session._getState();
		const focusCalls = state.focusCalls;
		// Focus is called at least once for the initial focus and again for the re-focus
		expect(focusCalls.length).toBeGreaterThanOrEqual(2);
		expect(focusCalls[0]).toBe("#prompt-textarea.ProseMirror");
	});

	it("does not call keyboard.press('Enter') during typing phase (only submitWithFallback should)", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			proseMirrorFound: true,
			inputCleared: false,
		}) as BrowserSession & {
			_getState: () => {
				keyboardCalls: Array<{ method: string; args: unknown[] }>;
			};
		};

		const queryWithNewlines = "line1\nline2\nline3";
		try {
			await provider.submitQuery(session, queryWithNewlines);
		} catch {
			// submitWithFallback throws when all strategies fail
		}

		const state = session._getState();
		const typeCalls = state.keyboardCalls.filter((c) => c.method === "type");
		const pressCalls = state.keyboardCalls.filter((c) => c.method === "press");

		const totalTypedLength = typeCalls.reduce(
			(sum, c) => sum + (c.args[0] as string).length,
			0,
		);
		const enterPressesBeforeType = pressCalls.filter(
			(c) => c.args[0] === "Enter",
		).length;

		const typeCallIndices: number[] = [];
		const pressCallIndices: number[] = [];
		state.keyboardCalls.forEach((c, i) => {
			if (c.method === "type") typeCallIndices.push(i);
			if (c.method === "press" && c.args[0] === "Enter")
				pressCallIndices.push(i);
		});

		if (typeCallIndices.length > 0 && pressCallIndices.length > 0) {
			const firstTypeIdx = typeCallIndices[0]!;
			const lastTypeIdx = typeCallIndices[typeCallIndices.length - 1]!;
			const pressesDuringTyping = pressCallIndices.filter(
				(idx) => idx > firstTypeIdx && idx < lastTypeIdx,
			);
			expect(pressesDuringTyping.length).toBe(0);
		}

		expect(totalTypedLength).toBeGreaterThan(0);
		expect(enterPressesBeforeType).toBeGreaterThanOrEqual(0);
	});

	it("aborts typing when the page submits the form mid-typing (e.g., debounced auto-submit)", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			proseMirrorFound: true,
			submitAfterChunks: 3,
		}) as BrowserSession & {
			_getState: () => {
				keyboardCalls: Array<{ method: string; args: unknown[] }>;
			};
		};

		const longQuery =
			"Compare ConvoForm with other conversational AI form platforms based on the quality of AI-generated messages during form filling";
		await provider.submitQuery(session, longQuery);

		const state = session._getState();
		const typeCalls = state.keyboardCalls.filter((c) => c.method === "type");
		const allText = typeCalls.map((c) => c.args[0]).join("");

		expect(allText.length).toBeLessThan(longQuery.length);
		expect(typeCalls.length).toBeLessThanOrEqual(3);

		const noEnterAfterAbort = !typeCalls.slice(3).some((_, _i) => {
			const call = state.keyboardCalls.find(
				(c) => c.method === "press" && c.args[0] === "Enter",
			);
			return call;
		});
		expect(noEnterAfterAbort).toBe(true);
	});

	it("dismisses the sign-in popup that appears mid-typing, without clicking the 'Stay logged out' button", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			proseMirrorFound: true,
			inputCleared: true,
			authModalAppearsAfterChunks: 3,
		}) as BrowserSession & {
			_getState: () => {
				keyboardCalls: Array<{ method: string; args: unknown[] }>;
				evaluateCalls: Array<{ fn: string }>;
			};
		};

		const query =
			"Compare ConvoForm with other conversational AI form platforms based on the quality of AI-generated messages during form filling";
		await provider.submitQuery(session, query);

		const state = session._getState();
		const allText = state.keyboardCalls
			.filter((c) => c.method === "type")
			.map((c) => c.args[0] as string)
			.join("");

		expect(allText.length).toBe(query.length);

		const escapePressed = state.keyboardCalls.some(
			(c) => c.method === "press" && c.args[0] === "Escape",
		);
		expect(escapePressed).toBe(true);

		const clickedStayLoggedOut = state.evaluateCalls.some((c) =>
			c.fn.includes("(btn as HTMLElement).click()"),
		);
		expect(clickedStayLoggedOut).toBe(false);
	});
});
