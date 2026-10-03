#!/usr/bin/env bun
import { openBrowser, closeBrowser } from "../src/browser";
import { PerplexityProvider } from "../src/providers/perplexity";
import { createLogger } from "@opencited/logger";
import { env } from "../src/env";

const QUERY = "How can I automate customer support with voice AI?";

async function main() {
	const logger = createLogger("info");
	const provider = new PerplexityProvider(logger);
	const session = await openBrowser(
		{ headless: env.HEADLESS, persist: false },
		logger,
	);

	try {
		await provider.navigate(session);
		await provider.submitQuery(session, QUERY);
		console.log("SUCCESS", session.page.url());
	} catch (error) {
		const page = session.page;
		const buttons = await page.evaluate(() => {
			const input = document.querySelector("#ask-input");
			const inputRect = input?.getBoundingClientRect();
			return Array.from(document.querySelectorAll("button")).map((btn) => {
				const rect = btn.getBoundingClientRect();
				return {
					text: (btn.textContent ?? "").trim().slice(0, 40),
					aria: btn.getAttribute("aria-label"),
					disabled: btn.disabled,
					rect: {
						top: Math.round(rect.top),
						left: Math.round(rect.left),
						w: Math.round(rect.width),
						h: Math.round(rect.height),
					},
					nearInput:
						inputRect &&
						Math.abs(rect.bottom - inputRect.bottom) < 72 &&
						rect.left >= inputRect.left - 20,
				};
			});
		});
		console.error("FAIL", error);
		console.log(JSON.stringify({ url: page.url(), buttons }, null, 2));
		await page.screenshot({
			path: "debug/perplexity-debug-submit.png",
			fullPage: true,
		});
	} finally {
		await closeBrowser(session);
	}
}

main().catch(console.error);
