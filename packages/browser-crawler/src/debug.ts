import * as fs from "node:fs";
import * as path from "node:path";
import { screenshot } from "./browser";
import type { BrowserSession } from "./types";
import type { FailureType } from "./errors";
import type { Logger } from "./logger";
import { defaultLogger } from "./logger";
import { env } from "./env";

const DEBUG_DIR = path.join(__dirname, "..", "debug");

export async function captureDebugInfo(
	session: BrowserSession,
	error: unknown,
	provider: string,
	step: string,
	failureType: FailureType,
	proxyServer?: string,
	logger?: Logger,
): Promise<void> {
	const log = logger ?? defaultLogger;
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

	await screenshot(session, pngPath, log);

	const url = session.page.url();
	const title = await session.page.title();
	const errorMsg = error instanceof Error ? error.message : String(error);

	log.error("DEBUG PAUSE ACTIVATED");
	log.error(`Provider: ${provider}`);
	log.error(`Step: ${step}`);
	log.error(`Failure type: ${failureType}`);
	log.error(`URL: ${url}`);
	log.error(`Title: ${title}`);
	log.error(`Error: ${errorMsg}`);
	if (proxyServer) log.error(`Proxy: ${proxyServer}`);
	log.error(`HTML: ${htmlPath}`);
	log.error(`Screenshot: ${pngPath}`);
	log.error(
		`Browser will pause for ${env.DEBUG_PAUSE_DURATION_MS / 1000}s — interact with it now`,
	);

	await new Promise((resolve) =>
		setTimeout(resolve, env.DEBUG_PAUSE_DURATION_MS),
	);
	log.info("Debug pause complete, continuing...");
}
