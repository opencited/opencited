#!/usr/bin/env bun
import { openBrowser, closeBrowser, navigate } from "../src/index";
import { env } from "../src/env";

async function main() {
	console.log("🚀 Browser Crawler Playground\n");
	console.log("📍 Testing login persistence on expandtesting.com\n");

	const userDataDir = "./.playwrite-playground";
	let isClosing = false;
	const session = await openBrowser({
		headless: env.HEADLESS,
		userDataDir,
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
		await navigate(session, "https://www.perplexity.ai/");

		console.log("\n✅ Browser is ready!");
		console.log("   Interact with the page manually.");
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
