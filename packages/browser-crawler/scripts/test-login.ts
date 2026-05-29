#!/usr/bin/env bun
import { openBrowser, closeBrowser, navigate } from "../src/index";
import type { BrowserSession } from "../src/types";
import { env } from "../src/env";

async function login(session: BrowserSession) {
	console.log("🔐 Attempting login...");

	// Wait for page to be fully loaded
	await session.page.waitForSelector("#username", { state: "visible" });

	// Fill in credentials
	console.log("   Entering username...");
	await session.page.fill("#username", "practice");

	console.log("   Entering password...");
	await session.page.fill("#password", "SuperSecretPassword!");

	// Click login button
	console.log("   Submitting login form...");
	await Promise.all([
		session.page.waitForURL(/\/secure/),
		session.page.click("#submit-login"),
	]);

	// Check if login was successful
	const currentUrl = session.page.url();
	console.log(`   Current URL: ${currentUrl}`);

	// Check for logout link (indicates successful login)
	const isLoggedIn =
		currentUrl.includes("/secure") ||
		(await session.page.isVisible("#logout").catch(() => false)) ||
		(await session.page.isVisible('a[href="/logout"]').catch(() => false));

	if (isLoggedIn) {
		console.log("✅ Login successful!");
		return true;
	}

	console.log("⚠️  Login status unclear");
	return false;
}

async function checkSession(session: BrowserSession) {
	console.log("🔍 Checking session status...");

	const currentUrl = session.page.url();
	console.log(`   Current URL: ${currentUrl}`);

	// Check if already logged in (redirected to secure area or logout button visible)
	const isLoggedIn =
		currentUrl.includes("/secure") ||
		(await session.page.isVisible("#logout").catch(() => false)) ||
		(await session.page.isVisible('a[href="/logout"]').catch(() => false));

	if (isLoggedIn) {
		console.log("✅ Already logged in! Session persisted.");
		return true;
	}

	console.log("⚠️  Not logged in. Need to login.");
	return false;
}

async function main() {
	console.log("🚀 Testing Persistent Session Login\n");

	const userDataDir = "./.playwrite-playground";
	const session = await openBrowser({
		headless: env.HEADLESS,
		userDataDir,
	});

	try {
		// First, try navigating directly to the secure page
		console.log("🔗 Navigating to secure page to test session...");
		await navigate(session, "https://practice.expandtesting.com/secure");

		// Give it a moment to settle
		await new Promise((resolve) => setTimeout(resolve, 1000));

		// Check if already logged in
		const hasSession = await checkSession(session);

		if (!hasSession) {
			// Need to login - navigate to login page
			console.log("\n🔗 Redirecting to login page...");
			await navigate(session, "https://practice.expandtesting.com/login");
			await new Promise((resolve) => setTimeout(resolve, 1000));

			// Need to login
			const loginSuccess = await login(session);

			if (!loginSuccess) {
				console.log("❌ Login failed. Exiting.");
				process.exit(1);
			}

			// Wait a bit to ensure cookies are saved
			console.log("\n💾 Waiting for cookies to be saved...");
			await new Promise((resolve) => setTimeout(resolve, 2000));
		}

		console.log("\n✅ Test complete!");
	} finally {
		await closeBrowser(session, userDataDir);
	}
}

main().catch((error) => {
	console.error("❌ Error:", error);
	process.exit(1);
});
