import { describe, expect, it, mock } from "bun:test";
import { ChatGPTProvider } from "../src/providers/chatgpt";
import type { BrowserSession } from "../src/types";

function createMockSession(
	options: {
		candidates?: Array<{
			text?: string;
			ariaLabel?: string;
			insideResponse?: boolean;
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

				// findSourcesButton: scoring algorithm
				if (
					fnStr.includes("\\bsources?\\b") ||
					fnStr.includes("sourcesButton")
				) {
					let bestScore = 0;
					for (const c of candidates) {
						let score = 0;
						const TEXT_RE = /\b\d+\s*sources?\b/i;
						const ARIA_RE = /\bsources?\b/i;
						if (c.text && TEXT_RE.test(c.text)) score += 120;
						if (c.ariaLabel && ARIA_RE.test(c.ariaLabel)) score += 90;
						if (c.insideResponse) score += 60;
						if (score > bestScore) bestScore = score;
					}
					if (bestScore >= 60) {
						return Promise.resolve({ found: true, score: bestScore });
					}
					return Promise.resolve({ found: false });
				}

				// extractPanelLinks
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
					return Promise.resolve(links);
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
	it("scores text match '3 sources' at 120", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			candidates: [{ text: "3 sources" }],
		}) as BrowserSession;

		const result = await (provider as any).findSourcesButton(session);
		expect(result).toEqual({ found: true, score: 120 });
	});

	it("scores '1 source' (singular) at 120", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			candidates: [{ text: "1 source" }],
		}) as BrowserSession;

		const result = await (provider as any).findSourcesButton(session);
		expect(result).toEqual({ found: true, score: 120 });
	});

	it("adds 90 for aria-label containing 'sources'", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			candidates: [{ text: "3 sources", ariaLabel: "View sources" }],
		}) as BrowserSession;

		const result = await (provider as any).findSourcesButton(session);
		expect(result).toEqual({ found: true, score: 210 });
	});

	it("adds 60 when button is inside an assistant response element", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			candidates: [{ text: "3 sources", insideResponse: true }],
		}) as BrowserSession;

		const result = await (provider as any).findSourcesButton(session);
		expect(result).toEqual({ found: true, score: 180 });
	});

	it("combines all three scores (text + aria-label + inside response)", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			candidates: [
				{ text: "5 sources", ariaLabel: "Open sources", insideResponse: true },
			],
		}) as BrowserSession;

		const result = await (provider as any).findSourcesButton(session);
		expect(result).toEqual({ found: true, score: 270 });
	});

	it("returns not-found when score is below threshold (60)", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			candidates: [{ text: "some text", ariaLabel: "unrelated" }],
		}) as BrowserSession;

		const result = await (provider as any).findSourcesButton(session);
		expect(result).toEqual({ found: false });
	});

	it("returns not-found when no candidates exist", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			candidates: [],
		}) as BrowserSession;

		const result = await (provider as any).findSourcesButton(session);
		expect(result).toEqual({ found: false });
	});

	it("picks the highest-scoring candidate", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			candidates: [
				{ text: "Sources", insideResponse: true }, // 60
				{ text: "3 sources", ariaLabel: "View sources" }, // 210
			],
		}) as BrowserSession;

		const result = await (provider as any).findSourcesButton(session);
		expect(result).toEqual({ found: true, score: 210 });
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
			candidates: [{ text: "3 sources" }],
			panelLinks: [],
		}) as BrowserSession;

		const result = await (provider as any).extractFromSourcesPanel(session);
		expect(result).toEqual([]);
	});

	it("extractFromSourcesPanel extracts links when button and panel present", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			candidates: [{ text: "3 sources" }],
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
							return [
								{
									title: "Panel Source",
									url: "https://panel.com",
									domain: "panel.com",
									citedText: "From panel",
									position: 1,
								},
							];
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
		const links = result.structured?.inlineLinks ?? [];
		expect(links).toHaveLength(1);
		expect(links[0].title).toBe("Panel Source");
		expect(links[0].domain).toBe("panel.com");
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
