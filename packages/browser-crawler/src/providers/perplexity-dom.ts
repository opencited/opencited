/** Anonymous / bot-blocked search results (not a crawler hang). */
export function perplexityBodyHasLoginWall(bodyText: string): boolean {
	const text = bodyText.replace(/\s+/g, " ").trim();
	if (/sign up and repeat your request/i.test(text)) {
		return true;
	}
	if (/something went wrong/i.test(text) && /sign up/i.test(text)) {
		return true;
	}
	return false;
}

export function normalizePerplexityQueryText(text: string): string {
	return text.replace(/\s+/g, " ").trim();
}

/** Detect when the ask box contains the same query twice (Playwright fill quirk). */
export function isDuplicatedPerplexityQuery(
	actual: string,
	query: string,
): boolean {
	const a = normalizePerplexityQueryText(actual);
	const q = normalizePerplexityQueryText(query);
	if (!q) return false;
	if (a === q + q) return true;
	if (
		a.startsWith(q) &&
		normalizePerplexityQueryText(a.slice(q.length)).startsWith(q)
	) {
		return true;
	}
	return a.includes(q + q);
}

/** Composer selectors tried in order (homepage markup / hydration varies). */
export const PERPLEXITY_ASK_INPUT_CANDIDATE_SELECTORS = [
	"#ask-input",
	"textarea#ask-input",
	'textarea[placeholder*="Type" i]',
	'textarea[placeholder*="Ask" i]',
	'[contenteditable="true"][role="textbox"]',
	'div[role="textbox"]',
] as const;

/** Injected into page.evaluate — tags the composer with id ask-input when found. */
export const PERPLEXITY_ENSURE_ASK_INPUT_FN = (
	selectors: readonly string[],
) => {
	function isVisible(el: Element): boolean {
		const style = window.getComputedStyle(el);
		const rect = el.getBoundingClientRect();
		return (
			style.display !== "none" &&
			style.visibility !== "hidden" &&
			rect.width > 0 &&
			rect.height > 0
		);
	}

	for (const sel of selectors) {
		const el = document.querySelector(sel);
		if (el instanceof HTMLElement && isVisible(el)) {
			if (el.id !== "ask-input") {
				el.id = "ask-input";
			}
			return { ok: true as const, matched: sel };
		}
	}

	const vh = window.innerHeight;
	for (const el of document.querySelectorAll(
		"textarea, [contenteditable='true']",
	)) {
		if (!(el instanceof HTMLElement) || !isVisible(el)) continue;
		const rect = el.getBoundingClientRect();
		if (rect.top < vh * 0.3 || rect.width < 180) continue;
		el.id = "ask-input";
		return { ok: true as const, matched: "heuristic-bottom-composer" };
	}

	return { ok: false as const, matched: null };
};

/** DOM selectors for Perplexity answer content (homepage markup changes often). */
export const PERPLEXITY_ANSWER_SELECTORS = [
	'div[id^="markdown-content-"] .prose',
	'[id^="markdown-content-"]',
	"main .prose",
	'main [class*="prose"]',
] as const;

/** Injected into page.evaluate — keep in sync with wait/extract logic. */
export const PERPLEXITY_RESPONSE_STATE_FN = () => {
	function isVisible(el: Element): boolean {
		const style = window.getComputedStyle(el);
		const rect = el.getBoundingClientRect();
		return (
			style.display !== "none" &&
			style.visibility !== "hidden" &&
			rect.width > 0 &&
			rect.height > 0
		);
	}

	function isStopGenerating(): boolean {
		for (const btn of document.querySelectorAll("button")) {
			const label = (btn.getAttribute("aria-label") ?? "").toLowerCase();
			if (!label.includes("stop")) continue;
			if (btn.getAttribute("aria-disabled") === "true") continue;
			if (!isVisible(btn)) continue;
			if (
				label.includes("generat") ||
				label.includes("respond") ||
				label === "stop" ||
				label.includes("stop ")
			) {
				return true;
			}
		}
		return false;
	}

	function answerContentLength(): number {
		let max = 0;
		for (const sel of [
			'div[id^="markdown-content-"] .prose',
			'[id^="markdown-content-"]',
			"main .prose",
			'main [class*="prose"]',
		]) {
			const el = document.querySelector(sel);
			if (el && isVisible(el)) {
				max = Math.max(max, el.textContent?.length ?? 0);
			}
		}
		if (max < 80 && location.pathname.includes("/search")) {
			const main = document.querySelector("main");
			if (main) {
				for (const el of main.querySelectorAll('[class*="prose"], article')) {
					if (!isVisible(el)) continue;
					max = Math.max(max, el.textContent?.length ?? 0);
				}
			}
		}
		return max;
	}

	const copyBtn = document.querySelector('button[aria-label="Copy"]');
	const hasCopyButton = copyBtn ? isVisible(copyBtn) : false;

	return {
		isStreaming: isStopGenerating(),
		contentLength: answerContentLength(),
		hasCopyButton,
	};
};
