import { exec, execSync } from "node:child_process";
import { Camoufox } from "camoufox-js";
import type { Browser, BrowserContext, Page } from "playwright-core";
import { env } from "./env";
import type { BrowserOptions, BrowserSession, ProxyOptions } from "./types";
import type { Logger } from "@opencited/logger";
import { defaultLogger } from "@opencited/logger";

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
	viewport: { width: 1366, height: 768 },
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

function buildWindowOption(
	viewport?: { width: number; height: number } | null,
) {
	return viewport
		? { window: [viewport.width, viewport.height] as [number, number] }
		: {};
}

export async function openBrowser(
	options: BrowserOptions = {},
	logger?: Logger,
): Promise<BrowserSession> {
	const log = logger ?? defaultLogger;
	const opts = {
		...DEFAULT_OPTIONS,
		...options,
		...{
			viewport: options.viewport ?? DEFAULT_OPTIONS.viewport ?? undefined,
		},
	};

	const isPersistent = !!opts.userDataDir;

	log.info(
		`Opening Camoufox browser (headless: ${opts.headless}, persistent: ${isPersistent})...`,
	);

	if (opts.proxy) {
		log.info(`Using proxy: ${opts.proxy.server}`);
	}

	let browser: Browser | undefined;
	let context: BrowserContext;
	let page: Page;

	const launchTimeoutMs = 30_000;
	const launchTimeout = new Promise<never>((_, reject) => {
		setTimeout(() => {
			reject(
				new Error(
					`Browser launch timeout (${launchTimeoutMs}ms) - proxy may be unreachable: ${opts.proxy?.server ?? "none"}`,
				),
			);
		}, launchTimeoutMs);
	});

	if (opts.userDataDir) {
		const userDataDir = opts.userDataDir.startsWith("/")
			? opts.userDataDir
			: `${process.cwd()}/${opts.userDataDir}`;

		log.info(`Using persistent session: ${userDataDir}`);

		context = (await Promise.race([
			Camoufox({
				headless: opts.headless,
				user_data_dir: userDataDir,
				...buildProxyOptions(opts.proxy),
				...buildWindowOption(opts.viewport),
			}),
			launchTimeout,
		])) as BrowserContext;

		log.info("Camoufox persistent context created");

		const existingPage = context.pages().find((p) => !p.isClosed());
		page = existingPage ?? (await context.newPage());
		if (opts.viewport) {
			await page.setViewportSize(opts.viewport);
		}
		if (existingPage) {
			try {
				await page.waitForLoadState("domcontentloaded", { timeout: 2000 });
			} catch {
				// Page might be blank or about:blank, that's ok
			}
		}
	} else {
		log.info(
			"Creating Camoufox instance with a temporary session (no persistence)",
		);
		browser = (await Promise.race([
			Camoufox({
				headless: opts.headless,
				...buildProxyOptions(opts.proxy),
				...buildWindowOption(opts.viewport),
			}),
			launchTimeout,
		])) as Browser;
		log.info("Camoufox browser launched");

		log.info("Creating new browser context...");
		context = await browser.newContext({
			viewport: opts.viewport ?? undefined,
		});
		log.info("Browser context created");

		log.info("Creating new page...");
		page = await context.newPage();
		log.info("Page created");
	}

	log.info("Browser ready");
	return { browser, context, page };
}

export async function closeBrowser(
	session: BrowserSession,
	userDataDir?: string,
	logger?: Logger,
): Promise<void> {
	const log = logger ?? defaultLogger;
	log.info("Closing browser...");

	if (userDataDir) {
		log.info(`Session persisted in: ${userDataDir}`);
	}

	// 1. Close context first (prevents memory leaks from page wrappers)
	try {
		await session.context.close();
	} catch {
		// ignore
	}

	// 2. Close browser (non-persistent sessions)
	if (session.browser) {
		try {
			await session.browser.close();
		} catch {
			// ignore
		}
	}

	// 3. Kill Xvfb virtual display processes (headless virtual mode)
	killXvfbProcesses();

	// 4. Give the OS time to clean up the browser process
	await sleep(1500);

	// 5. Kill any orphaned processes that weren't properly cleaned up
	await killOrphanedProcesses();

	log.info("Browser closed");
}

export async function navigate(
	session: BrowserSession,
	url: string,
	logger?: Logger,
): Promise<void> {
	const log = logger ?? defaultLogger;
	log.info(`Navigating to: ${url}`);
	await session.page.goto(url, { waitUntil: "networkidle" });
	log.info(`Loaded: ${session.page.url()}`);
}

export async function takeSnapshot(session: BrowserSession): Promise<string> {
	const snapshot = await session.page.content();
	return snapshot;
}

export async function screenshot(
	session: BrowserSession,
	filename?: string,
	logger?: Logger,
): Promise<string> {
	const log = logger ?? defaultLogger;
	const path = filename ?? `screenshot-${Date.now()}.png`;
	await session.page.screenshot({ path, fullPage: true });
	log.info(`Screenshot saved: ${path}`);
	return path;
}

export async function reload(
	session: BrowserSession,
	logger?: Logger,
): Promise<void> {
	const log = logger ?? defaultLogger;
	log.info("Reloading page...");
	await session.page.reload({ waitUntil: "networkidle" });
}

export async function goBack(
	session: BrowserSession,
	logger?: Logger,
): Promise<void> {
	const log = logger ?? defaultLogger;
	log.info("Going back...");
	await session.page.goBack({ waitUntil: "networkidle" });
}

export async function goForward(
	session: BrowserSession,
	logger?: Logger,
): Promise<void> {
	const log = logger ?? defaultLogger;
	log.info("Going forward...");
	await session.page.goForward({ waitUntil: "networkidle" });
}
