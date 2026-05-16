#!/usr/bin/env bun
import { openBrowser, closeBrowser, navigate } from "../src/index";

async function main() {
	console.log("🚀 Testing Persistent Session\n");
	console.log(
		"This script will keep the browser open until you press Ctrl+C\n",
	);

	const session = await openBrowser({
		headless: false,
		userDataDir: "./.playwrite-playground",
	});

	let isClosing = false;

	const cleanup = async () => {
		if (isClosing) return;
		isClosing = true;
		console.log("\n\n🔒 Closing browser gracefully...");
		await closeBrowser(session);
		console.log("✅ Session saved to: ./.playwrite-playground");
		console.log("📝 Run the script again to test if your login persists!\n");
		process.exit(0);
	};

	process.on("SIGINT", async () => {
		await cleanup();
	});

	process.on("SIGTERM", async () => {
		await cleanup();
	});

	try {
		await navigate(session, "https://practice.expandtesting.com/login");

		console.log("\n✅ Browser is ready!");
		console.log("   📝 Login to the website now");
		console.log("   ⏳ Wait until you're fully logged in");
		console.log("   🔴 Press Ctrl+C to save session and exit\n");

		await new Promise(() => {
			// Keep running forever
		});
	} finally {
		await cleanup();
	}
}

main().catch((error) => {
	console.error("❌ Error:", error);
	process.exit(1);
});
