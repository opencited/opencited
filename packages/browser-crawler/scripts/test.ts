#!/usr/bin/env bun
import {
	openBrowser,
	closeBrowser,
	navigate,
	extractContent,
} from "../src/index";

const TEST_URL = process.argv[2] ?? "https://example.com";

console.log(`\n🌐 Testing browser crawler with: ${TEST_URL}\n`);

const session = await openBrowser({ headless: true });

try {
	await navigate(session, TEST_URL);

	const content = await extractContent(session, {
		text: true,
		links: true,
		images: true,
	});

	console.log("\n📊 Results:");
	console.log(`   Title: ${content.title}`);
	console.log(`   URL: ${content.url}`);
	console.log(`   Words: ${content.metadata.wordCount}`);
	console.log(`   Links: ${content.links?.length ?? 0}`);
	console.log(`   Images: ${content.images?.length ?? 0}`);

	if (content.text) {
		console.log("\n📝 Text preview:");
		console.log(content.text.substring(0, 300));
		console.log(`... (${content.text.length} total chars)\n`);
	}

	if (content.links && content.links.length > 0) {
		console.log("🔗 Links:");
		content.links.slice(0, 5).forEach((link, i) => {
			console.log(`   ${i + 1}. ${link.text} -> ${link.href}`);
		});
		console.log();
	}

	console.log("✅ Test passed!\n");
} catch (error) {
	console.error("❌ Test failed:", error);
	process.exit(1);
} finally {
	await closeBrowser(session);
}
