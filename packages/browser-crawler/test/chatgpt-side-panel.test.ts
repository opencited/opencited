import { describe, expect, it, mock } from "bun:test";
import { ChatGPTProvider } from "../src/providers/chatgpt";
import type { BrowserSession } from "../src/types";

function createMockSession(
	options: {
		candidates?: Array<{
			text?: string;
			ariaLabel?: string;
			className?: string;
			insideResponse?: boolean;
			isBelowResponse?: boolean;
		}>;
		panelLinks?: Array<{
			title: string;
			url: string;
			citedText?: string;
			targetBlank?: boolean;
			hasHref?: boolean;
		}>;
	} = {},
): BrowserSession {
	const { candidates = [], panelLinks = [] } = options;

	const evaluateCalls: Array<{ fn: string; args: unknown }> = [];

	const fakePage = {
		url: () => "https://chatgpt.com/c/test",
		title: () => Promise.resolve("ChatGPT"),
		goto: mock(async () => {}),
		waitForTimeout: mock(async () => {}),
		evaluate: mock(
			async (
				fnOrFn: ((...args: unknown[]) => unknown) | string,
				args?: unknown,
			) => {
				const fnStr = typeof fnOrFn === "function" ? fnOrFn.toString() : fnOrFn;
				evaluateCalls.push({ fn: fnStr, args });

				// findSourcesButton / clickSourcesButton: scoring algorithm.
				// Real provider scores on (text 120 / aria 90 / footnote 50 /
				// belowResponse 50), accepts ≥ 140. The "must be inside response"
				// hard gate is gone — ChatGPT's "Sources" button is a footnote
				// that lives at the bottom of the page, OUTSIDE the assistant
				// message element. The sidebar toggle (which IS outside and has
				// no footnote class) is correctly rejected because it scores 0
				// on both new signals.
				if (
					fnStr.includes("\\bsources?\\b") ||
					fnStr.includes("sourcesButton")
				) {
					let bestScore = 0;
					let bestTag = "";
					let bestText = "";
					let bestAria = "";
					for (const c of candidates) {
						const text = c.text ?? "";
						const ariaLabel = c.ariaLabel ?? "";
						const className = c.className ?? "";
						const isFootnote = className.toLowerCase().includes("footnote");
						const isBelowResponse = c.isBelowResponse ?? false;
						let score = 0;
						const TEXT_RE = /\b\d+\s*sources?\b/i;
						const ARIA_RE = /\bsources?\b/i;
						if (text && TEXT_RE.test(text)) score += 120;
						if (ariaLabel && ARIA_RE.test(ariaLabel)) score += 90;
						if (isFootnote) score += 50;
						if (isBelowResponse) score += 50;
						if (score > bestScore) {
							bestScore = score;
							bestTag = c.tag ?? "";
							bestText = text;
							bestAria = ariaLabel;
						}
					}
					if (bestScore >= 140) {
						return Promise.resolve({
							found: true,
							score: bestScore,
							tag: bestTag,
							text: bestText,
							ariaLabel: bestAria,
						});
					}
					return Promise.resolve({ found: false });
				}

				// extractPanelLinks — real function now returns
				// { panelFound, anchorCount, links } from the evaluate callback
				if (fnStr.includes("ul li > a")) {
					const links = panelLinks
						.filter((l) => l.hasHref !== false)
						.filter((l) => l.targetBlank === true || l.citedText !== undefined)
						.map((l, i) => ({
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

				// Panel dialog check
				if (
					fnStr.includes('role="dialog"') ||
					fnStr.includes('data-state="open"')
				) {
					return Promise.resolve(panelLinks.length > 0);
				}

				return Promise.resolve(false);
			},
		),
	};

	return {
		browser: {} as never,
		context: {} as never,
		page: fakePage as never,
		_getState: () => ({ evaluateCalls }),
	} as unknown as BrowserSession & {
		_getState: () => { evaluateCalls: Array<{ fn: string; args: unknown }> };
	};
}

describe("ChatGPTProvider.findSourcesButton scoring", () => {
	it("ACCEPTS the real ChatGPT Sources button — aria 'Sources' + footnote class + below response (90+50+50 = 190)", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			candidates: [
				{
					tag: "button",
					ariaLabel: "Sources",
					text: "Sources",
					className:
						"group/footnote bg-transparent hover:bg-token-surface-hover flex w-fit items-center gap-1.5 rounded-lg py-1.5 ps-3 pe-3",
					insideResponse: false,
					isBelowResponse: true,
				},
			],
		}) as BrowserSession;

		const result = await (provider as any).findSourcesButton(session);
		expect(result.found).toBe(true);
		expect(result.score).toBe(190);
		expect(result.ariaLabel).toBe("Sources");
	});

	it("accepts the old 'N sources' text button (text 120 + aria 90 + footnote 50 + below 50 = 310)", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			candidates: [
				{
					tag: "button",
					text: "5 sources",
					ariaLabel: "Sources",
					className: "group/footnote",
					insideResponse: false,
					isBelowResponse: true,
				},
			],
		}) as BrowserSession;

		const result = await (provider as any).findSourcesButton(session);
		expect(result.found).toBe(true);
		expect(result.score).toBe(310);
	});

	it("REJECTS the chat-history sidebar 'Sources' toggle (aria only = 90, no footnote, no below-response — both new signals = 0)", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			candidates: [
				{
					tag: "button",
					text: "Sources",
					ariaLabel: "Sources",
					insideResponse: false,
					isBelowResponse: false, // sidebar is at the top
				},
			],
		}) as BrowserSession;

		const result = await (provider as any).findSourcesButton(session);
		expect(result).toEqual({ found: false });
	});

	it("REJECTS an in-response inline link 'ConvoForm' (no aria, no footnote, not below — score 0)", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			candidates: [{ tag: "a", text: "ConvoForm", insideResponse: true }],
		}) as BrowserSession;

		const result = await (provider as any).findSourcesButton(session);
		expect(result).toEqual({ found: false });
	});

	it("REJECTS a 'Copy table' button (inside response but no sources signal)", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			candidates: [
				{ tag: "button", ariaLabel: "Copy table", insideResponse: true },
			],
		}) as BrowserSession;

		const result = await (provider as any).findSourcesButton(session);
		expect(result).toEqual({ found: false });
	});

	it("accepts when only the below-response signal is present (defensive — class might change)", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			candidates: [
				{ ariaLabel: "Sources", insideResponse: false, isBelowResponse: true },
			],
		}) as BrowserSession;

		const result = await (provider as any).findSourcesButton(session);
		expect(result.found).toBe(true);
		expect(result.score).toBe(140);
	});

	it("accepts when only the footnote class signal is present (defensive — position might change)", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			candidates: [
				{
					ariaLabel: "Sources",
					className: "group/footnote",
					insideResponse: false,
					isBelowResponse: false,
				},
			],
		}) as BrowserSession;

		const result = await (provider as any).findSourcesButton(session);
		expect(result.found).toBe(true);
		expect(result.score).toBe(140);
	});

	it("picks the highest-scoring candidate", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			candidates: [
				// Sidebar (low score)
				{ ariaLabel: "Sources", insideResponse: false, isBelowResponse: false },
				// Real footnote (highest)
				{
					text: "5 sources",
					ariaLabel: "Sources",
					className: "group/footnote",
					insideResponse: false,
					isBelowResponse: true,
				},
			],
		}) as BrowserSession;

		const result = await (provider as any).findSourcesButton(session);
		expect(result.found).toBe(true);
		expect(result.score).toBe(310);
	});

	it("returns not-found when no candidates exist", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			candidates: [],
		}) as BrowserSession;

		const result = await (provider as any).findSourcesButton(session);
		expect(result).toEqual({ found: false });
	});
});

describe("ChatGPTProvider.extractPanelLinks", () => {
	it("extracts links from panel with citedText", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			panelLinks: [
				{
					title: "TypeScript Handbook",
					url: "https://typescriptlang.org/handbook",
					citedText:
						"The official TypeScript documentation covers all features.",
					targetBlank: true,
				},
			],
		}) as BrowserSession;

		const result = await (provider as any).extractPanelLinks(session);
		expect(result).toHaveLength(1);
		expect(result[0]).toEqual({
			title: "TypeScript Handbook",
			url: "https://typescriptlang.org/handbook",
			domain: "typescriptlang.org",
			citedText: "The official TypeScript documentation covers all features.",
			position: 1,
		});
	});

	it("returns empty array when panel has no matching links", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			panelLinks: [],
		}) as BrowserSession;

		const result = await (provider as any).extractPanelLinks(session);
		expect(result).toEqual([]);
	});

	it("extracts multiple links with correct positions", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			panelLinks: [
				{
					title: "First",
					url: "https://a.com",
					citedText: "A",
					targetBlank: true,
				},
				{
					title: "Second",
					url: "https://b.com",
					citedText: "B",
					targetBlank: true,
				},
				{
					title: "Third",
					url: "https://c.com",
					citedText: "C",
					targetBlank: true,
				},
			],
		}) as BrowserSession;

		const result = await (provider as any).extractPanelLinks(session);
		expect(result).toHaveLength(3);
		expect(result[0].position).toBe(1);
		expect(result[1].position).toBe(2);
		expect(result[2].position).toBe(3);
	});

	it("parses domain correctly stripping www", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			panelLinks: [
				{
					title: "Example",
					url: "https://www.example.com/article",
					citedText: "An example",
					targetBlank: true,
				},
			],
		}) as BrowserSession;

		const result = await (provider as any).extractPanelLinks(session);
		expect(result[0].domain).toBe("example.com");
	});
});

describe("ChatGPTProvider side-panel fallback to inline links", () => {
	it("extractFromSourcesPanel returns empty when no button found", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			candidates: [],
		}) as BrowserSession;

		const result = await (provider as any).extractFromSourcesPanel(session);
		expect(result).toEqual([]);
	});

	it("extractFromSourcesPanel returns empty when button found but panel has no links", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			candidates: [
				{
					text: "3 sources",
					ariaLabel: "Sources",
					className: "group/footnote",
					insideResponse: false,
					isBelowResponse: true,
				},
			],
			panelLinks: [],
		}) as BrowserSession;

		const result = await (provider as any).extractFromSourcesPanel(session);
		expect(result).toEqual([]);
	});

	it("extractFromSourcesPanel extracts links when button and panel present", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			candidates: [
				{
					text: "3 sources",
					ariaLabel: "Sources",
					className: "group/footnote",
					insideResponse: false,
					isBelowResponse: true,
				},
			],
			panelLinks: [
				{
					title: "Source Link",
					url: "https://source.com",
					citedText: "A cited source",
					targetBlank: true,
				},
			],
		}) as BrowserSession;

		const result = await (provider as any).extractFromSourcesPanel(session);
		expect(result).toHaveLength(1);
		expect(result[0].title).toBe("Source Link");
		expect(result[0].domain).toBe("source.com");
	});

	it("extractResult prefers panel links over inline when panel available", async () => {
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

						// findLatestResponseElement
						if (
							fnStr.includes("data-message-author-role") &&
							fnStr.includes("cloneNode")
						) {
							return {
								innerHTML:
									'<p>Check out <a class="decorated-link" href="https://inline.com">Inline</a> for details about this topic in modern web development.</p>',
								outerHTML: "<div>response</div>",
								processedHTML:
									'<p>Check out <a class="decorated-link" href="https://inline.com">Inline</a> for details about this topic in modern web development.</p>',
							};
						}

						// extractInlineLinks
						if (fnStr.includes("decorated-link")) {
							return [
								{
									title: "Inline",
									url: "https://inline.com",
									domain: "inline.com",
									position: 1,
								},
							];
						}

						// findSourcesButton — found
						if (fnStr.includes("\\bsources?\\b")) {
							return { found: true, score: 120 };
						}

						// extractPanelLinks
						if (fnStr.includes("ul li > a")) {
							return {
								panelFound: true,
								anchorCount: 1,
								links: [
									{
										title: "Panel Source",
										url: "https://panel.com",
										domain: "panel.com",
										citedText: "From panel",
										position: 1,
									},
								],
							};
						}

						// Panel click/close
						if (
							fnStr.includes('role="dialog"') ||
							fnStr.includes('data-state="open"')
						) {
							return true;
						}

						return false;
					},
				),
			},
		} as unknown as BrowserSession;

		const result = await provider.extractResult(session);
		const panelLinks = result.structured?.sourcePanelLinks ?? [];
		expect(panelLinks).toHaveLength(1);
		expect(panelLinks[0].title).toBe("Panel Source");
		expect(panelLinks[0].domain).toBe("panel.com");
		const inlineLinks = result.structured?.inlineLinks ?? [];
		expect(inlineLinks).toHaveLength(1);
		expect(inlineLinks[0].title).toBe("Inline");
		expect(inlineLinks[0].domain).toBe("inline.com");
	});

	it("extractResult falls back to inline links when no panel button found", async () => {
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

						// findLatestResponseElement
						if (
							fnStr.includes("data-message-author-role") &&
							fnStr.includes("cloneNode")
						) {
							return {
								innerHTML:
									'<p>Check out <a class="decorated-link" href="https://inline.com">Inline</a> for details about this topic in modern web development.</p>',
								outerHTML: "<div>response</div>",
								processedHTML:
									'<p>Check out <a class="decorated-link" href="https://inline.com">Inline</a> for details about this topic in modern web development.</p>',
							};
						}

						// extractInlineLinks
						if (fnStr.includes("decorated-link")) {
							return [
								{
									title: "Inline",
									url: "https://inline.com",
									domain: "inline.com",
									position: 1,
								},
							];
						}

						// findSourcesButton — not found
						if (fnStr.includes("\\bsources?\\b")) {
							return { found: false };
						}

						return false;
					},
				),
			},
		} as unknown as BrowserSession;

		const result = await provider.extractResult(session);
		const links = result.structured?.inlineLinks ?? [];
		expect(links).toHaveLength(1);
		expect(links[0].title).toBe("Inline");
		expect(links[0].domain).toBe("inline.com");
	});
});
