#!/usr/bin/env bun
import {
	openBrowser,
	closeBrowser,
	navigate,
	waitFor,
	type,
	press,
	click,
	getClipboard,
} from "../src/index";

async function main() {
	console.log("🚀 Perplexity.ai Search Crawler\n");

	const userDataDir = "./.playwrite-playground";
	const query = "top ai contact center";
	let isClosing = false;

	const session = await openBrowser({
		headless: false,
		// userDataDir,
	});

	const cleanup = async () => {
		if (isClosing) return;
		isClosing = true;
		console.log("\n🔒 Closing browser gracefully...");
		await closeBrowser(session, userDataDir);
	};

	process.on("SIGINT", async () => {
		await cleanup();
		process.exit(0);
	});

	process.on("SIGTERM", async () => {
		await cleanup();
		process.exit(0);
	});

	try {
		console.log("📍 Step 1: Navigating to Perplexity...");
		await navigate(session, "https://www.perplexity.ai/");

		console.log("📍 Step 2: Waiting for search input...");
		await waitFor(session, "#ask-input", 10000);

		console.log("📍 Step 3: Entering query...");
		await type(session, "#ask-input", query);

		console.log("📍 Step 4: Pressing Enter...");
		await press(session, "Enter");

		console.log("📍 Step 5: Waiting for search results...");
		await session.page.waitForLoadState("networkidle");
		await session.page.waitForTimeout(3000);

		console.log("📍 Step 6: Looking for Copy button...");
		const copyButtonLocated = await waitFor(
			session,
			'button[aria-label="Copy"]',
			15000,
		);

		if (copyButtonLocated) {
			console.log("📍 Step 7: Clicking Copy button...");
			await click(session, 'button[aria-label="Copy"]');
			await session.page.waitForTimeout(1000);
		} else {
			console.log("⚠️  Copy button not found, continuing...");
		}

		// Log copied content using the new helper
		const copiedContent = await getClipboard(session);
		console.log("\n📋 Copied Content:");
		console.log("-------------------");
		console.log(copiedContent);
		console.log("-------------------\n");

		console.log("\n✅ Browser is ready!");
		console.log("   Press Ctrl+C to exit.\n");

		await new Promise(() => {
			// Never resolve - keeps script alive
		});
	} finally {
		await cleanup();
	}
}

main().catch((error) => {
	console.error("❌ Error:", error);
	process.exit(1);
});
