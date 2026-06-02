import * as fs from "node:fs";
import * as path from "node:path";
import { screenshot } from "./browser";
import type { BrowserSession } from "./types";
import type { FailureType } from "./errors";
import { env } from "./env";

const DEBUG_DIR = path.join(__dirname, "..", "debug");

export async function captureDebugInfo(
	session: BrowserSession,
	error: unknown,
	provider: string,
	step: string,
	failureType: FailureType,
	proxyServer?: string,
): Promise<void> {
	if (!env.DEBUG_PAUSE_ON_FAILURE) return;

	fs.mkdirSync(DEBUG_DIR, { recursive: true });
	const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
	const label = `${provider}-${step}-${timestamp}`;

	const htmlPath = path.join(DEBUG_DIR, `${label}.html`);
	const pngPath = path.join(DEBUG_DIR, `${label}.png`);

	const html = await session.page.evaluate(
		() => document.documentElement.outerHTML,
	);
	fs.writeFileSync(htmlPath, html, "utf-8");

	await screenshot(session, pngPath);

	const url = session.page.url();
	const title = await session.page.title();
	const errorMsg = error instanceof Error ? error.message : String(error);

	console.log("🔴 DEBUG PAUSE ACTIVATED");
	console.log(`   Provider: ${provider}`);
	console.log(`   Step: ${step}`);
	console.log(`   Failure type: ${failureType}`);
	console.log(`   URL: ${url}`);
	console.log(`   Title: ${title}`);
	console.log(`   Error: ${errorMsg}`);
	if (proxyServer) console.log(`   Proxy: ${proxyServer}`);
	console.log(`   HTML: ${htmlPath}`);
	console.log(`   Screenshot: ${pngPath}`);
	console.log(
		`   ⏸️  Browser will pause for ${env.DEBUG_PAUSE_DURATION_MS / 1000}s — interact with it now`,
	);

	await new Promise((resolve) =>
		setTimeout(resolve, env.DEBUG_PAUSE_DURATION_MS),
	);
	console.log("▶️  Debug pause complete, continuing...");
}
