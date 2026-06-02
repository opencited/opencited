import { Camoufox } from "camoufox-js";
import { exec, execSync } from "node:child_process";
import type { BrowserSession, BrowserOptions, ProxyOptions } from "./types";
import type { Browser, BrowserContext, Page } from "playwright-core";
import { env } from "./env";

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function killXvfbProcesses(): void {
	try {
		execSync("pkill -TERM -f 'Xvfb' 2>/dev/null || true");
	} catch {
		// No Xvfb processes found
	}
}

function killOrphanedProcesses(): Promise<void> {
	return new Promise((resolve) => {
		exec("pkill -f 'camoufox\\|chromium' 2>/dev/null || true", () => {
			resolve();
		});
	});
}

const DEFAULT_OPTIONS: Omit<BrowserOptions, "userDataDir"> & {
	userDataDir?: string;
} = {
	headless: env.HEADLESS,
	viewport: null,
	userDataDir: undefined,
};

function buildProxyOptions(proxy?: ProxyOptions) {
	if (!proxy) return {};
	const result: Record<string, string | boolean> = {
		proxy: proxy.server,
		geoip: true,
	};
	if (proxy.username && proxy.password) {
		result.proxyUsername = proxy.username;
		result.proxyPassword = proxy.password;
	}
	return result;
}

export async function openBrowser(
	options: BrowserOptions = {},
): Promise<BrowserSession> {
	const opts = { ...DEFAULT_OPTIONS, ...options };

	const isPersistent = !!opts.userDataDir;

	console.log(
		`🌐 Opening Camoufox browser (headless: ${opts.headless}, persistent: ${isPersistent})...`,
	);

	let browser: Browser | undefined;
	let context: BrowserContext;
	let page: Page;

	if (opts.userDataDir) {
		const userDataDir = opts.userDataDir.startsWith("/")
			? opts.userDataDir
			: `${process.cwd()}/${opts.userDataDir}`;

		console.log(`📁 Using persistent session: ${userDataDir}`);

		context = (await Camoufox({
			headless: opts.headless,
			user_data_dir: userDataDir,
			...buildProxyOptions(opts.proxy),
		})) as BrowserContext;

		const existingPage = context.pages().find((p) => !p.isClosed());
		page = existingPage ?? (await context.newPage());
		if (existingPage) {
			try {
				await page.waitForLoadState("domcontentloaded", { timeout: 2000 });
			} catch {
				// Page might be blank or about:blank, that's ok
			}
		}
	} else {
		console.log(
			"Creating Camoufox instance with a temporary session (no persistence)",
		);
		browser = (await Camoufox({
			headless: opts.headless,
			...buildProxyOptions(opts.proxy),
		})) as Browser;
		console.log("Creating new browser context...");
		context = await browser.newContext({
			viewport: opts.viewport ?? undefined,
		});
		console.log("Creating new page...");
		page = await context.newPage();
	}

	console.log("✅ Browser ready");
	return { browser, context, page };
}

export async function closeBrowser(
	session: BrowserSession,
	userDataDir?: string,
): Promise<void> {
	console.log("🔒 Closing browser...");

	if (userDataDir) {
		console.log(`💾 Session persisted in: ${userDataDir}`);
	}

	// 1. Close context first (prevents memory leaks from page wrappers)
	await session.context.close().catch(() => null);

	// 2. Close browser (non-persistent sessions)
	if (session.browser) {
		await session.browser.close().catch(() => null);
	}

	// 3. Kill Xvfb virtual display processes (headless virtual mode)
	killXvfbProcesses();

	// 4. Give the OS time to clean up the browser process
	await sleep(1500);

	// 5. Kill any orphaned processes that weren't properly cleaned up
	await killOrphanedProcesses();

	console.log("✅ Browser closed");
}

export async function navigate(
	session: BrowserSession,
	url: string,
): Promise<void> {
	console.log(`🔗 Navigating to: ${url}`);
	await session.page.goto(url, { waitUntil: "networkidle" });
	console.log(`✅ Loaded: ${session.page.url()}`);
}

export async function takeSnapshot(session: BrowserSession): Promise<string> {
	const snapshot = await session.page.content();
	return snapshot;
}

export async function screenshot(
	session: BrowserSession,
	filename?: string,
): Promise<string> {
	const path = filename ?? `screenshot-${Date.now()}.png`;
	await session.page.screenshot({ path, fullPage: true });
	console.log(`📸 Screenshot saved: ${path}`);
	return path;
}

export async function reload(session: BrowserSession): Promise<void> {
	console.log("🔄 Reloading page...");
	await session.page.reload({ waitUntil: "networkidle" });
}

export async function goBack(session: BrowserSession): Promise<void> {
	console.log("⬅️ Going back...");
	await session.page.goBack({ waitUntil: "networkidle" });
}

export async function goForward(session: BrowserSession): Promise<void> {
	console.log("➡️ Going forward...");
	await session.page.goForward({ waitUntil: "networkidle" });
}
