import { promises as fs } from "node:fs";
import * as path from "node:path";
import type { BrowserSession } from "./types";

export interface DebugContext {
	session: BrowserSession;
	outputDir: string;
}

const TEXT_RE = /\b\d+\s*sources?\b/i;
const ARIA_RE = /\bsources?\b/i;

/**
 * Capture the full page state to `outputDir/<label>/`:
 *   - page.png            (full-page screenshot)
 *   - page.html           (full document HTML)
 *   - last-response.html  (outerHTML of the last assistant message, or null)
 *   - candidates.json     (every button/anchor matching the sources heuristic,
 *                          with score, parent chain, and bounding rect)
 *
 * Reusable across providers and across future ChatGPT UI changes — the only
 * provider-specific assumption is the `[data-message-author-role="assistant"]`
 * selector, which we look up dynamically.
 */
export async function capturePageState(
	ctx: DebugContext,
	label: string,
): Promise<{ dir: string; candidates: SourceCandidate[] }> {
	const dir = path.join(ctx.outputDir, label);
	await fs.mkdir(dir, { recursive: true });

	const safeLabel = label.replace(/[^a-z0-9_-]/gi, "_");
	const screenshotPath = path.join(dir, `${safeLabel}.png`);

	try {
		await ctx.session.page.screenshot({
			path: screenshotPath,
			fullPage: true,
		});
	} catch (e) {
		await fs.writeFile(
			path.join(dir, "screenshot-error.txt"),
			e instanceof Error ? e.message : String(e),
		);
	}

	try {
		const html = await ctx.session.page.content();
		await fs.writeFile(path.join(dir, "page.html"), html);
	} catch (e) {
		await fs.writeFile(
			path.join(dir, "html-error.txt"),
			e instanceof Error ? e.message : String(e),
		);
	}

	const responseHtml = await ctx.session.page.evaluate(() => {
		const els = document.querySelectorAll(
			'[data-message-author-role="assistant"]',
		);
		const last = els[els.length - 1] as HTMLElement | undefined;
		return last ? last.outerHTML : null;
	});
	if (responseHtml) {
		await fs.writeFile(path.join(dir, "last-response.html"), responseHtml);
	}

	const candidates = await probeSourcesCandidates(ctx);
	await fs.writeFile(
		path.join(dir, "sources-candidates.json"),
		JSON.stringify(candidates, null, 2),
	);

	return { dir, candidates };
}

export interface SourceCandidate {
	idx: number;
	tag: string;
	role: string | null;
	text: string;
	ariaLabel: string;
	className: string;
	insideLastAssistantResponse: boolean;
	isBelowLastResponse: boolean;
	isFootnote: boolean;
	textScore: number;
	ariaScore: number;
	footnoteScore: number;
	belowResponseScore: number;
	totalScore: number;
	closestAssistantAncestor: string | null;
	rect: { x: number; y: number; width: number; height: number };
	outerHtmlPreview: string;
}

export async function probeSourcesCandidates(
	ctx: DebugContext,
): Promise<SourceCandidate[]> {
	return ctx.session.page.evaluate(
		({ textRe, ariaRe }) => {
			const TEXT_RE = new RegExp(textRe, "i");
			const ARIA_RE = new RegExp(ariaRe, "i");

			const responseEls = Array.from(
				document.querySelectorAll('[data-message-author-role="assistant"]'),
			);
			const lastResp = responseEls[responseEls.length - 1] as
				| HTMLElement
				| undefined;
			const responseBottom = lastResp
				? lastResp.getBoundingClientRect().bottom
				: 0;

			const candidates = Array.from(
				document.querySelectorAll('button, [role="button"], a[href]'),
			).map((el, i) => {
				const text = (el.textContent ?? "").trim().slice(0, 120);
				const ariaLabel = el.getAttribute("aria-label") ?? "";
				const className = el.getAttribute("class") ?? "";
				const inside =
					!!lastResp && (lastResp.contains(el) || el.contains(lastResp));

				// Walk up the parent chain to find the closest ancestor with
				// data-message-author-role. The button might live in a sibling
				// subtree (e.g. footnote area) and the `inside` check above
				// would miss that — this surfaces the real relationship.
				const closestAssistantAncestor = (() => {
					let cur: HTMLElement | null = el.parentElement;
					while (cur) {
						const role = cur.getAttribute("data-message-author-role");
						if (role) return role;
						cur = cur.parentElement;
					}
					return null;
				})();

				const rect = el.getBoundingClientRect();
				const isBelowResponse = lastResp !== null && rect.top > responseBottom;
				const isFootnote = className.toLowerCase().includes("footnote");

				const textScore = TEXT_RE.test(text) ? 120 : 0;
				const ariaScore = ARIA_RE.test(ariaLabel) ? 90 : 0;
				const footnoteScore = isFootnote ? 50 : 0;
				const belowResponseScore = isBelowResponse ? 50 : 0;

				return {
					idx: i,
					tag: el.tagName.toLowerCase(),
					role: el.getAttribute("role"),
					text,
					ariaLabel,
					className: className.slice(0, 200),
					insideLastAssistantResponse: inside,
					isBelowLastResponse: isBelowResponse,
					isFootnote,
					textScore,
					ariaScore,
					footnoteScore,
					belowResponseScore,
					totalScore:
						textScore + ariaScore + footnoteScore + belowResponseScore,
					closestAssistantAncestor,
					rect: {
						x: rect.x,
						y: rect.y,
						width: rect.width,
						height: rect.height,
					},
					outerHtmlPreview: el.outerHTML.slice(0, 300),
				};
			});

			return candidates.filter((c) => c.totalScore > 0);
		},
		{ textRe: TEXT_RE.source, ariaRe: ARIA_RE.source },
	);
}

/**
 * Poll the page for a "Sources" button that meets the real threshold,
 * giving the streaming response time to fully render the sources footer.
 * Returns null if the timeout expires.
 */
export async function waitForSourcesButton(
	ctx: DebugContext,
	timeoutMs = 5000,
	pollMs = 250,
): Promise<{ found: true; candidate: SourceCandidate } | { found: false }> {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		const candidates = await probeSourcesCandidates(ctx);
		const winner = candidates.sort((a, b) => b.totalScore - a.totalScore)[0];
		if (winner && winner.totalScore >= 140) {
			return { found: true, candidate: winner };
		}
		await new Promise((r) => setTimeout(r, pollMs));
	}
	return { found: false };
}
