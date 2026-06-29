import { describe, expect, it, mock } from "bun:test";
import { ChatGPTProvider } from "../src/providers/chatgpt";
import type { BrowserSession } from "../src/types";

function createMockSession(
	options: {
		responseHTML?: string;
		responseInner?: string;
		inlineLinks?: Array<{ text: string; href: string }>;
		botDetectionText?: string;
		extractionEmpty?: boolean;
	} = {},
): BrowserSession {
	const {
		responseHTML = "<div><p>Hello world</p></div>",
		responseInner = "<p>Hello world</p>",
		inlineLinks = [],
		botDetectionText = "",
		extractionEmpty = false,
	} = options;

	const evaluateCalls: Array<{ fn: string; args: unknown }> = [];
	const waitForTimeoutCalls: number[] = [];

	const fakePage = {
		url: () => "https://chatgpt.com/c/test-conversation",
		title: () => Promise.resolve("ChatGPT"),
		goto: mock(async () => {}),
		waitForLoadState: mock(async () => {}),
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
				args?: unknown,
			) => {
				const fnStr = typeof fnOrFn === "function" ? fnOrFn.toString() : fnOrFn;
				evaluateCalls.push({ fn: fnStr, args });

				// findLatestResponseElement: returns innerHTML, outerHTML, and processed innerHTML
				if (
					fnStr.includes("data-message-author-role") &&
					fnStr.includes("cloneNode")
				) {
					if (extractionEmpty) {
						return Promise.resolve(null);
					}
					return Promise.resolve({
						innerHTML: responseInner,
						outerHTML: responseHTML,
						processedHTML: responseInner,
					});
				}

				// extractInlineLinks from decorated-link anchors
				if (fnStr.includes("decorated-link")) {
					return Promise.resolve(
						inlineLinks.map((l, i) => ({
							title: l.text,
							url: l.href,
							domain: new URL(l.href).hostname.replace("www.", ""),
							position: i + 1,
						})),
					);
				}

				// Bot detection validation
				if (fnStr.includes("our systems have detected")) {
					return Promise.resolve(botDetectionText);
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
			evaluateCalls,
			waitForTimeoutCalls,
		}),
	} as unknown as BrowserSession & {
		_getState: () => {
			evaluateCalls: Array<{ fn: string; args: unknown }>;
			waitForTimeoutCalls: number[];
		};
	};
}

describe("ChatGPTProvider.findLatestResponseElement", () => {
	it("picks the last visible assistant response element", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			responseInner: "<p>Latest response</p>",
		}) as BrowserSession & {
			_getState: () => {
				evaluateCalls: Array<{ fn: string; args: unknown }>;
			};
		};

		const result = await (provider as any).findLatestResponseElement(session);

		expect(result).toBeDefined();
		expect(result.processedHTML).toContain("Latest response");

		const state = session._getState();
		const findCall = state.evaluateCalls.find(
			(c) =>
				c.fn.includes("data-message-author-role") && c.fn.includes("cloneNode"),
		);
		expect(findCall).toBeDefined();
	});

	it("returns null when no assistant response exists", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			extractionEmpty: true,
		}) as BrowserSession;

		const result = await (provider as any).findLatestResponseElement(session);
		expect(result).toBeNull();
	});

	it("clones and strips aria-hidden, sup, buttons, and action bars from response", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			responseInner:
				'<p>Hello</p><sup>1</sup><button>Copy</button><div data-testid="copy-turn-action-button">action</div><div aria-hidden="true">hidden</div>',
		}) as BrowserSession & {
			_getState: () => {
				evaluateCalls: Array<{ fn: string; args: unknown }>;
			};
		};

		const result = await (provider as any).findLatestResponseElement(session);

		expect(result).not.toBeNull();
		const state = session._getState();
		const cloneCall = state.evaluateCalls.find(
			(c) =>
				c.fn.includes("cloneNode") &&
				c.fn.includes("aria-hidden") &&
				c.fn.includes("sup") &&
				c.fn.includes("button") &&
				c.fn.includes("copy-turn-action-button"),
		);
		expect(cloneCall).toBeDefined();
	});

	it("extractResult returns content via turndown conversion", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			responseInner:
				"<p>TypeScript is a typed superset of JavaScript that adds optional static typing and class-based object-oriented programming to the language.</p>",
		}) as BrowserSession;

		const result = await provider.extractResult(session);

		expect(result.provider).toBe("chatgpt");
		expect(result.content).toContain("TypeScript is a typed superset");
		expect(result.metadata.url).toContain("chatgpt.com");
	});

	it("extractResult includes InlineLink[] from decorated-link anchors", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			responseInner:
				'<p>Check out <a class="decorated-link" href="https://example.com">Example</a> for more details about this topic and how it relates to modern web development practices.</p>',
			inlineLinks: [
				{
					text: "Example",
					href: "https://example.com",
				},
			],
		}) as BrowserSession;

		const result = await provider.extractResult(session);

		expect(result.structured?.inlineLinks).toHaveLength(1);
		expect(result.structured?.inlineLinks?.[0]).toEqual({
			title: "Example",
			url: "https://example.com",
			domain: "example.com",
			position: 1,
		});
	});

	it("extractResult returns empty inlineLinks when no decorated-link anchors exist", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			responseInner:
				"<p>This is a response with no links at all. It contains enough text to pass the minimum length check for extraction validation purposes.</p>",
			inlineLinks: [],
		}) as BrowserSession;

		const result = await provider.extractResult(session);

		expect(result.structured?.inlineLinks).toEqual([]);
	});

	it("extractResult rejects bot-detection content and retries", async () => {
		const provider = new ChatGPTProvider();
		let callCount = 0;
		const session = {
			page: {
				url: () => "https://chatgpt.com/c/test",
				title: () => Promise.resolve("ChatGPT"),
				waitForTimeout: mock(async () => {}),
				evaluate: mock(
					async (fnOrFn: ((...args: unknown[]) => unknown) | string) => {
						const fnStr =
							typeof fnOrFn === "function" ? fnOrFn.toString() : fnOrFn;

						if (
							fnStr.includes("data-message-author-role") &&
							fnStr.includes("cloneNode")
						) {
							callCount++;
							if (callCount <= 2) {
								return {
									innerHTML: "<p>Our systems have detected unusual traffic</p>",
									outerHTML:
										"<div>Our systems have detected unusual traffic</div>",
									processedHTML:
										"<p>Our systems have detected unusual traffic</p>",
								};
							}
							return {
								innerHTML:
									"<p>Valid response with enough content to pass validation.</p>",
								outerHTML: "<div>Valid response</div>",
								processedHTML:
									"<p>Valid response with enough content to pass validation.</p>",
							};
						}

						if (fnStr.includes("decorated-link")) {
							return Promise.resolve([]);
						}

						return Promise.resolve(false);
					},
				),
			},
		} as unknown as BrowserSession;

		const result = await provider.extractResult(session);

		expect(result.content).toContain("Valid response");
		expect(callCount).toBe(3);
	});

	it("extractResult rejects empty extraction and retries", async () => {
		const provider = new ChatGPTProvider();
		let callCount = 0;
		const session = {
			page: {
				url: () => "https://chatgpt.com/c/test",
				title: () => Promise.resolve("ChatGPT"),
				waitForTimeout: mock(async () => {}),
				evaluate: mock(
					async (fnOrFn: ((...args: unknown[]) => unknown) | string) => {
						const fnStr =
							typeof fnOrFn === "function" ? fnOrFn.toString() : fnOrFn;

						if (
							fnStr.includes("data-message-author-role") &&
							fnStr.includes("cloneNode")
						) {
							callCount++;
							if (callCount <= 2) {
								return {
									innerHTML: "<p>Hi</p>",
									outerHTML: "<div>Hi</div>",
									processedHTML: "<p>Hi</p>",
								};
							}
							return {
								innerHTML:
									"<p>This is a valid response with enough content to pass the minimum length check.</p>",
								outerHTML: "<div>Valid</div>",
								processedHTML:
									"<p>This is a valid response with enough content to pass the minimum length check.</p>",
							};
						}

						if (fnStr.includes("decorated-link")) {
							return Promise.resolve([]);
						}

						return Promise.resolve(false);
					},
				),
			},
		} as unknown as BrowserSession;

		const result = await provider.extractResult(session);

		expect(result.content).toContain("valid response");
		expect(callCount).toBe(3);
	});

	it("extractResult throws after max retries on persistent validation failure", async () => {
		const provider = new ChatGPTProvider();
		const session = {
			page: {
				url: () => "https://chatgpt.com/c/test",
				title: () => Promise.resolve("ChatGPT"),
				waitForTimeout: mock(async () => {}),
				evaluate: mock(
					async (fnOrFn: ((...args: unknown[]) => unknown) | string) => {
						const fnStr =
							typeof fnOrFn === "function" ? fnOrFn.toString() : fnOrFn;

						if (
							fnStr.includes("data-message-author-role") &&
							fnStr.includes("cloneNode")
						) {
							return {
								innerHTML: "<p>Please verify you're human</p>",
								outerHTML: "<div>Please verify you're human</div>",
								processedHTML: "<p>Please verify you're human</p>",
							};
						}

						return Promise.resolve(false);
					},
				),
			},
		} as unknown as BrowserSession;

		await expect(provider.extractResult(session)).rejects.toThrow(
			/bot detection|retries/i,
		);
	});

	it("extractResult throws after max retries on persistent empty extraction", async () => {
		const provider = new ChatGPTProvider();
		const session = {
			page: {
				url: () => "https://chatgpt.com/c/test",
				title: () => Promise.resolve("ChatGPT"),
				waitForTimeout: mock(async () => {}),
				evaluate: mock(
					async (fnOrFn: ((...args: unknown[]) => unknown) | string) => {
						const fnStr =
							typeof fnOrFn === "function" ? fnOrFn.toString() : fnOrFn;

						if (
							fnStr.includes("data-message-author-role") &&
							fnStr.includes("cloneNode")
						) {
							return {
								innerHTML: "<p>Short</p>",
								outerHTML: "<div>Short</div>",
								processedHTML: "<p>Short</p>",
							};
						}

						return Promise.resolve(false);
					},
				),
			},
		} as unknown as BrowserSession;

		await expect(provider.extractResult(session)).rejects.toThrow(
			/empty extraction|too short/i,
		);
	});

	it("extractResult throws when no assistant response element found", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			extractionEmpty: true,
		}) as BrowserSession;

		await expect(provider.extractResult(session)).rejects.toThrow(
			/no assistant response/i,
		);
	});
});
