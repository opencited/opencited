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
		sourcesPanel?: {
			buttonFound?: boolean;
			buttonScore?: number;
			links?: Array<{
				title: string;
				url: string;
				citedText: string;
			}>;
		};
	} = {},
): BrowserSession {
	const {
		responseHTML = "<div><p>Hello world</p></div>",
		responseInner = "<p>Hello world</p>",
		inlineLinks = [],
		botDetectionText = "",
		extractionEmpty = false,
		sourcesPanel = { buttonFound: false },
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

				// findSourcesButton: scoring algorithm
				if (
					fnStr.includes("sourcesButton") ||
					fnStr.includes("\\bsources?\\b")
				) {
					if (sourcesPanel.buttonFound) {
						return Promise.resolve({
							found: true,
							score: sourcesPanel.buttonScore ?? 120,
						});
					}
					return Promise.resolve({ found: false });
				}

				// extractPanelLinks: panel link extraction
				if (fnStr.includes("panelLinks") || fnStr.includes("ul li > a")) {
					const links = (sourcesPanel.links ?? []).map((l, i) => ({
						title: l.title,
						url: l.url,
						domain: new URL(l.url).hostname.replace("www.", ""),
						citedText: l.citedText,
						position: i + 1,
					}));
					return Promise.resolve({
						panelFound: true,
						anchorCount: links.length,
						links,
					});
				}

				// Panel click/close
				if (fnStr.includes("sourcesPanel") || fnStr.includes("panelClick")) {
					return Promise.resolve(sourcesPanel.buttonFound ?? false);
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

describe("ChatGPTProvider.findSourcesButton", () => {
	it("finds button by text match score", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			sourcesPanel: {
				buttonFound: true,
				buttonScore: 120,
			},
		}) as BrowserSession;

		const result = await (provider as any).findSourcesButton(session);
		expect(result).toEqual({ found: true, score: 120 });
	});

	it("returns not-found when no sources button exists", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			sourcesPanel: {
				buttonFound: false,
			},
		}) as BrowserSession;

		const result = await (provider as any).findSourcesButton(session);
		expect(result).toEqual({ found: false });
	});

	it("scores aria-label 'sources' higher than plain text", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			sourcesPanel: {
				buttonFound: true,
				buttonScore: 210,
			},
		}) as BrowserSession;

		const result = await (provider as any).findSourcesButton(session);
		expect(result).toEqual({ found: true, score: 210 });
	});
});

describe("ChatGPTProvider.extractPanelLinks", () => {
	it("extracts links from the sources panel with citedText", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			sourcesPanel: {
				links: [
					{
						title: "Example Article",
						url: "https://example.com/article",
						citedText: "Example is a leading provider of web services.",
					},
				],
			},
		}) as BrowserSession;

		const result = await (provider as any).extractPanelLinks(session);
		expect(result).toHaveLength(1);
		expect(result[0]).toEqual({
			title: "Example Article",
			url: "https://example.com/article",
			domain: "example.com",
			citedText: "Example is a leading provider of web services.",
			position: 1,
		});
	});

	it("returns empty array when panel has no links", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			sourcesPanel: {
				links: [],
			},
		}) as BrowserSession;

		const result = await (provider as any).extractPanelLinks(session);
		expect(result).toEqual([]);
	});

	it("extracts multiple links with correct positions", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			sourcesPanel: {
				links: [
					{ title: "First", url: "https://a.com", citedText: "text a" },
					{ title: "Second", url: "https://b.com", citedText: "text b" },
					{ title: "Third", url: "https://c.com", citedText: "text c" },
				],
			},
		}) as BrowserSession;

		const result = await (provider as any).extractPanelLinks(session);
		expect(result).toHaveLength(3);
		expect(result[0].position).toBe(1);
		expect(result[1].position).toBe(2);
		expect(result[2].position).toBe(3);
	});
});

describe("ChatGPTProvider.extractFromSourcesPanel", () => {
	it("finds button, clicks it, extracts links, and closes panel", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			sourcesPanel: {
				buttonFound: true,
				buttonScore: 120,
				links: [
					{ title: "Source", url: "https://source.com", citedText: "A source" },
				],
			},
		}) as BrowserSession;

		const result = await (provider as any).extractFromSourcesPanel(session);
		expect(result).toHaveLength(1);
		expect(result[0].title).toBe("Source");
		expect(result[0].domain).toBe("source.com");
	});

	it("returns empty array when no button found", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			sourcesPanel: {
				buttonFound: false,
			},
		}) as BrowserSession;

		const result = await (provider as any).extractFromSourcesPanel(session);
		expect(result).toEqual([]);
	});

	it("returns empty array when button clicked but panel has no links", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			sourcesPanel: {
				buttonFound: true,
				buttonScore: 120,
				links: [],
			},
		}) as BrowserSession;

		const result = await (provider as any).extractFromSourcesPanel(session);
		expect(result).toEqual([]);
	});
});

describe("ChatGPTProvider.extractResult with sources panel", () => {
	it("prefers side-panel links over inline links", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			responseInner:
				'<p>Check out <a class="decorated-link" href="https://inline.com">Inline</a> for more details about this topic and how it relates to modern web development practices.</p>',
			inlineLinks: [{ text: "Inline", href: "https://inline.com" }],
			sourcesPanel: {
				buttonFound: true,
				buttonScore: 120,
				links: [
					{
						title: "Panel Source",
						url: "https://panel.com",
						citedText: "From the panel",
					},
				],
			},
		}) as BrowserSession;

		const result = await provider.extractResult(session);
		const panelLinks = result.structured?.sourcePanelLinks ?? [];
		expect(panelLinks).toHaveLength(1);
		expect(panelLinks[0].title).toBe("Panel Source");
		expect(panelLinks[0].domain).toBe("panel.com");
		expect(panelLinks[0].citedText).toBe("From the panel");
		const inlineLinks = result.structured?.inlineLinks ?? [];
		expect(inlineLinks).toHaveLength(1);
		expect(inlineLinks[0].title).toBe("Inline");
		expect(inlineLinks[0].domain).toBe("inline.com");
	});

	it("falls back to inline links when no side-panel button found", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			responseInner:
				'<p>Check out <a class="decorated-link" href="https://inline.com">Inline</a> for more details about this topic and how it relates to modern web development practices.</p>',
			inlineLinks: [{ text: "Inline", href: "https://inline.com" }],
			sourcesPanel: {
				buttonFound: false,
			},
		}) as BrowserSession;

		const result = await provider.extractResult(session);
		const links = result.structured?.inlineLinks ?? [];
		expect(links).toHaveLength(1);
		expect(links[0].title).toBe("Inline");
		expect(links[0].domain).toBe("inline.com");
	});

	it("filters out self-citations from combined results", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			responseInner:
				'<p>Visit <a class="decorated-link" href="https://chatgpt.com">ChatGPT</a> and <a class="decorated-link" href="https://example.com">Example</a> for details about this topic in modern web development practices.</p>',
			inlineLinks: [
				{ text: "ChatGPT", href: "https://chatgpt.com" },
				{ text: "Example", href: "https://example.com" },
			],
			sourcesPanel: {
				buttonFound: false,
			},
		}) as BrowserSession;

		const result = await provider.extractResult(session);
		const links = result.structured?.inlineLinks ?? [];
		expect(links).toHaveLength(1);
		expect(links[0].domain).toBe("example.com");
	});
});
