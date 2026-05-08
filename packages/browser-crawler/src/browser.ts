import { chromium, firefox, webkit } from "@playwright/test";
import type { BrowserSession, BrowserOptions } from "./types";
import type { Browser, BrowserContext, Page } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";

const DEFAULT_OPTIONS: Required<Omit<BrowserOptions, "userDataDir">> & {
	userDataDir?: string;
} = {
	headless: process.env.HEADLESS !== "false",
	browserName: "chromium",
	viewport: null,
	userAgent:
		"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
	userDataDir: undefined,
};

async function loadStorageState(userDataDir: string) {
	const storagePath = path.join(userDataDir, "storage-state.json");
	if (fs.existsSync(storagePath)) {
		try {
			const storageState = JSON.parse(fs.readFileSync(storagePath, "utf-8"));
			return storageState;
		} catch {
			return undefined;
		}
	}
	return undefined;
}

async function saveStorageState(context: BrowserContext, userDataDir: string) {
	try {
		const storageState = await context.storageState();
		fs.mkdirSync(userDataDir, { recursive: true });
		const storagePath = path.join(userDataDir, "storage-state.json");
		fs.writeFileSync(storagePath, JSON.stringify(storageState, null, 2));
		console.log(`💾 Session saved to: ${storagePath}`);
	} catch (error) {
		console.error("⚠️  Failed to save session:", error);
	}
}

export async function openBrowser(
	options: BrowserOptions = {},
): Promise<BrowserSession> {
	const opts = { ...DEFAULT_OPTIONS, ...options };

	console.log(
		`🌐 Opening ${opts.browserName} browser (headless: ${opts.headless})...`,
	);

	const browserType =
		opts.browserName === "firefox"
			? firefox
			: opts.browserName === "webkit"
				? webkit
				: chromium;

	let context: BrowserContext;
	let page: Page;
	let browser: Browser | undefined;

	if (opts.userDataDir) {
		// Convert to absolute path if relative
		const userDataDir = opts.userDataDir.startsWith("/")
			? opts.userDataDir
			: `${process.cwd()}/${opts.userDataDir}`;

		console.log(`📁 Using persistent session: ${userDataDir}`);

		// Try to load existing storage state
		const storageState = await loadStorageState(userDataDir);
		if (storageState) {
			console.log("📦 Found existing session, restoring...");
		}

		context = await browserType.launchPersistentContext(userDataDir, {
			headless: opts.headless,
			args: opts.headless ? [] : ["--start-maximized", "--disable-infobars"],
			viewport: opts.viewport ?? null,
			userAgent: opts.userAgent,
			acceptDownloads: false,
		});

		// Explicitly add cookies if we have them
		if (storageState?.cookies) {
			await context.addCookies(storageState.cookies);
			console.log(`🍪 Added ${storageState.cookies.length} cookies to context`);
		}

		await new Promise((resolve) => setTimeout(resolve, 1000));
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
		browser = await browserType.launch({
			headless: opts.headless,
			args: opts.headless ? [] : ["--start-maximized", "--disable-infobars"],
		});

		context = await browser.newContext({
			viewport: opts.viewport ?? null,
			userAgent: opts.userAgent,
		});

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

	// Save storage state before closing if userDataDir is provided
	if (userDataDir) {
		await saveStorageState(session.context, userDataDir);
	}

	try {
		if (session.browser) {
			await session.browser.close();
		} else {
			await session.context.close();
		}
	} catch (_error) {
		console.log("⚠️  Browser already closed or closing");
		return;
	}
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
