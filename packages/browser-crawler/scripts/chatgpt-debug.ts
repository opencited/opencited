#!/usr/bin/env bun
/**
 * ChatGPT debug harness.
 *
 * Runs the same lifecycle the worker runs (navigate → beforePrompt →
 * submitQuery → afterTyping → beforeSubmit → waitForResponse → afterSubmit
 * → extractResult), but at each step it dumps the full page state to a
 * timestamped directory:
 *
 *   debug/chatgpt-<ts>/
 *     01-post-navigate/
 *       page.png
 *       page.html
 *       last-response.html       (null if no response yet)
 *       sources-candidates.json  (empty if no candidates)
 *     02-post-beforePrompt/
 *       ...
 *     03-post-submit/
 *       ...
 *     04-post-afterTyping/
 *     05-post-beforeSubmit/
 *     06-post-stream/            (right after waitForResponse returns)
 *     07-after-extra-wait/        (5s later — sources button may appear late)
 *     08-post-extract/
 *     result.json
 *
 * How to use it
 * ------------
 * 1. In the worker environment (with cookies / auth state):
 *      bun run packages/browser-crawler/scripts/chatgpt-debug.ts
 *    It reads HEADLESS from env (default false).
 *
 * 2. In a fresh sandbox (no auth, headless only):
 *      HEADLESS=true bun run packages/browser-crawler/scripts/chatgpt-debug.ts
 *    Submission will likely fail (no login), but the script will still
 *    capture whatever state the page is in. The sources-candidates.json
 *    on the empty page is still useful as a baseline.
 *
 * 3. Share the contents of any /sources-candidates.json or screenshot with
 *    the agent. The agent can then diagnose the scoring without re-running.
 *
 * Why the candidates probe
 * -----------------------
 * Past ChatGPT UI changes have broken the scoring in subtle ways:
 *   - The button moved out of the assistant response
 *   - The aria-label changed (e.g. "Hide sources")
 *   - The text was wrapped in a nested <div> so .textContent still matches
 *   - The button didn't exist at all (bot-detection / no-search response)
 * The probe surfaces every candidate with its score breakdown so we can see
 * exactly which signal the algorithm is (or isn't) finding.
 */
import { openBrowser, closeBrowser, ChatGPTProvider } from "../src/index";
import {
	capturePageState,
	waitForSourcesButton,
	type DebugContext,
} from "../src/debug-state";
import { promises as fs } from "node:fs";
import * as path from "node:path";

const QUERY =
	"Compare ConvoForm with other conversational AI form platforms based on the quality of AI-generated messages during form filling";

async function main() {
	const debugRoot = path.join(process.cwd(), "debug");
	await fs.mkdir(debugRoot, { recursive: true });
	const outputDir = path.join(
		debugRoot,
		`chatgpt-${new Date().toISOString().replace(/[:.]/g, "-")}`,
	);
	await fs.mkdir(outputDir, { recursive: true });
	console.log(`📁 Debug output: ${outputDir}\n`);

	const session = await openBrowser({
		headless: process.env.HEADLESS === "true",
	});
	const ctx: DebugContext = { session, outputDir };

	let exitCode = 0;
	try {
		const provider = new ChatGPTProvider();

		console.log("=== Step 1: navigate ===");
		await provider.navigate(session);
		await capturePageState(ctx, "01-post-navigate");

		console.log("\n=== Step 2: beforePrompt ===");
		await provider.beforePrompt(session, QUERY);
		await capturePageState(ctx, "02-post-beforePrompt");

		console.log("\n=== Step 3: submitQuery ===");
		try {
			await provider.submitQuery(session, QUERY);
		} catch (e) {
			console.error(
				`⚠️  submitQuery failed: ${e instanceof Error ? e.message : e}`,
			);
			console.error(
				"   This is expected in headless + no-auth. Continuing to capture state.",
			);
			await capturePageState(ctx, "03-post-submit-FAILED");
			exitCode = 2;
		}
		if (exitCode === 0) {
			await capturePageState(ctx, "03-post-submit");
		}

		if (exitCode === 0) {
			console.log("\n=== Step 4: afterTyping ===");
			await provider.afterTyping(session, QUERY);
			await capturePageState(ctx, "04-post-afterTyping");

			console.log("\n=== Step 5: beforeSubmit ===");
			await provider.beforeSubmit(session, QUERY);
			await capturePageState(ctx, "05-post-beforeSubmit");

			console.log("\n=== Step 6: waitForResponse ===");
			await provider.waitForResponse(session);
			await capturePageState(ctx, "06-post-stream");

			console.log(
				"\n=== Step 7: extra wait (5s) — sources button may appear late ===",
			);
			await new Promise((r) => setTimeout(r, 5000));
			await capturePageState(ctx, "07-after-5s-extra-wait");

			console.log("\n=== Step 7b: waitForSourcesButton helper ===");
			const waited = await waitForSourcesButton(ctx, 5000);
			if (waited.found) {
				console.log(
					`   ✅ found: tag=${waited.candidate.tag} text="${waited.candidate.text}" aria="${waited.candidate.ariaLabel}" score=${waited.candidate.totalScore}`,
				);
			} else {
				console.log("   ❌ not found within 5s");
			}

			console.log("\n=== Step 8: extractResult ===");
			try {
				const result = await provider.extractResult(session);
				await capturePageState(ctx, "08-post-extract");

				const summary = {
					contentLength: result.content.length,
					contentPreview: result.content.slice(0, 500),
					inlineLinkCount: result.structured?.inlineLinks?.length ?? 0,
					inlineLinks: result.structured?.inlineLinks ?? [],
					url: result.metadata.url,
					title: result.metadata.title,
				};
				await fs.writeFile(
					path.join(outputDir, "result.json"),
					JSON.stringify(summary, null, 2),
				);
				console.log(
					`   contentLength=${summary.contentLength} inlineLinks=${summary.inlineLinkCount}`,
				);
			} catch (e) {
				console.error(
					`⚠️  extractResult failed: ${e instanceof Error ? e.message : e}`,
				);
				await capturePageState(ctx, "08-post-extract-FAILED");
				exitCode = 2;
			}
		}
	} finally {
		await closeBrowser(session);
	}

	console.log(`\n📁 Debug artifacts written to: ${outputDir}`);
	console.log(
		"   Look at: sources-candidates.json (scored list of every Sources button) and *.png (screenshots)\n",
	);
	process.exit(exitCode);
}

main().catch((e) => {
	console.error("Fatal:", e);
	process.exit(1);
});
