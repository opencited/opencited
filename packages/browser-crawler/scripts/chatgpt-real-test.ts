#!/usr/bin/env bun
import { ConsoleTransport, createLogger } from "@opencited/logger";
import { openBrowser, closeBrowser, ChatGPTProvider } from "../src/index";
import type { BrowserSession } from "../src/types";

const QUERY =
	"Compare ConvoForm with other conversational AI form platforms based on the quality of AI-generated messages during form filling";

async function snapshotState(session: BrowserSession, label: string) {
	const state = await session.page.evaluate(() => {
		const editor = document.querySelector(
			"#prompt-textarea.ProseMirror",
		) as HTMLElement | null;
		const editorText = editor?.textContent?.trim() ?? null;
		const editorRect = editor?.getBoundingClientRect();
		const editorHidden = !editorRect || editorRect.height === 0;

		const dialog = document.querySelector(
			'[role="dialog"][data-state="open"]',
		);
		const dialogText =
			(dialog?.textContent ?? "").slice(0, 120).replace(/\s+/g, " ").trim() ||
			null;

		const stopButton = document.querySelector(
			'button[data-testid="stop-button"]',
		);

		const userMessages = Array.from(
			document.querySelectorAll('[data-message-author-role="user"]'),
		).map((el) => (el.textContent ?? "").trim());

		const assistantMessages = Array.from(
			document.querySelectorAll('[data-message-author-role="assistant"]'),
		)
			.filter((el) => {
				const style = window.getComputedStyle(el);
				return style.display !== "none" && style.visibility !== "hidden";
			})
			.map((el) => (el.textContent ?? "").trim());

		return {
			url: window.location.href,
			editorText,
			editorHidden,
			dialogText,
			stopButtonVisible: !!stopButton,
			userMessages,
			assistantMessages,
		};
	});
	console.log(
		`[${label}] url=${state.url} editorTextLen=${state.editorText?.length ?? 0} editorHidden=${state.editorHidden} dialog=${state.dialogText ? "PRESENT" : "none"} stopVisible=${state.stopButtonVisible} userMsgs=${state.userMessages.length} assistantMsgs=${state.assistantMessages.length}`,
	);
	if (state.editorText) {
		console.log(`[${label}] editorText: "${state.editorText.slice(0, 120)}"`);
	}
	if (state.dialogText) {
		console.log(`[${label}] dialog: "${state.dialogText}"`);
	}
	return state;
}

async function runLifecycle(provider: ChatGPTProvider, session: BrowserSession) {
	console.log("\n--- Step 1: navigate ---");
	await provider.navigate(session);
	await snapshotState(session, "post-navigate");

	console.log("\n--- Step 2: beforePrompt ---");
	await provider.beforePrompt(session, QUERY);
	await snapshotState(session, "post-beforePrompt");

	console.log("\n--- Step 3: submitQuery ---");
	const submitStart = Date.now();
	try {
		await provider.submitQuery(session, QUERY);
		console.log(`submitQuery completed in ${Date.now() - submitStart}ms`);
	} catch (e) {
		console.error(
			`submitQuery threw after ${Date.now() - submitStart}ms:`,
			e instanceof Error ? e.message : e,
		);
		throw e;
	}
	await snapshotState(session, "post-submitQuery");

	console.log("\n--- Step 4: afterTyping ---");
	await provider.afterTyping(session, QUERY);

	console.log("\n--- Step 5: beforeSubmit ---");
	await provider.beforeSubmit(session, QUERY);

	console.log("\n--- Step 6: waitForResponse ---");
	const waitStart = Date.now();
	await provider.waitForResponse(session);
	console.log(`waitForResponse completed in ${Date.now() - waitStart}ms`);

	console.log("\n--- Step 7: afterSubmit ---");
	await provider.afterSubmit(session, QUERY);
}

async function main() {
	console.log("🚀 Real ChatGPTProvider test (full lifecycle, no LLM extraction)\n");
	console.log(`Query: "${QUERY}"\n`);

	const session = await openBrowser({ headless: false });
	const userDataDir: string | undefined = undefined;

	const cleanup = async () => {
		console.log("\n🔒 Closing browser...");
		await closeBrowser(session, userDataDir);
	};
	process.on("SIGINT", async () => {
		await cleanup();
		process.exit(0);
	});

	try {
		const provider = new ChatGPTProvider(
			createLogger({
				// NOTE: @opencited/logger has an inverted log-level hierarchy
				// (higher number = more restrictive). With "debug" only true debug
				// logs come through — all `info` logs (navigation, typing, extract,
				// etc.) are silently filtered. Use "info" to see both info and
				// debug output.
				level: "info",
				transports: [
					new ConsoleTransport({ level: "info", pretty: true }),
				],
			}),
		);

		await runLifecycle(provider, session);
		await snapshotState(session, "post-stream");

		console.log("\n--- Step 8: extractResult ---");
		const extractStart = Date.now();
		const result = await provider.extractResult(session);
		console.log(`extractResult completed in ${Date.now() - extractStart}ms`);

		console.log("\n========== CRAWL RESULT ==========");
		console.log(`provider: ${result.provider}`);
		console.log(`url: ${result.metadata.url}`);
		console.log(`title: ${result.metadata.title}`);
		console.log(`timestamp: ${result.metadata.timestamp.toISOString()}`);
		console.log(`loadTimeMs: ${result.metadata.loadTimeMs}`);
		console.log(`contentLength: ${result.content.length} chars`);
		console.log(`content preview (first 400 chars):`);
		console.log(`  "${result.content.slice(0, 400).replace(/\s+/g, " ")}"`);
		console.log(
			`inlineLinks: ${result.structured?.inlineLinks?.length ?? 0}`,
		);
		for (const link of result.structured?.inlineLinks ?? []) {
			console.log(
				`  [${link.position}] "${link.title}" → ${link.url} (${link.domain})${link.citedText ? ` [cited: "${link.citedText}"]` : ""}`,
			);
		}
		console.log(
			`citations: ${result.structured?.citations?.length ?? 0}`,
		);
		console.log(
			`brandMentions: ${result.structured?.brandMentions?.length ?? 0}`,
		);
		console.log("\n(no LLM extraction — the worker would call intakeCrawlResultAction here)");
	} catch (error) {
		console.error("❌ Top-level error:", error);
		await session.page.screenshot({
			path: "/tmp/chatgpt-error.png",
			fullPage: true,
		});
	} finally {
		await cleanup();
	}
}

main().catch((error) => {
	console.error("❌ Fatal:", error);
	process.exit(1);
});
