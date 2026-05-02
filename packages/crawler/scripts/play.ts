import { fetchPage, extractContent } from "@opencited/crawler";

const TEST_URL = process.argv[2] ?? "https://example.com";

console.log(`\n🔍 Crawling: ${TEST_URL}\n`);

try {
	const page = await fetchPage(TEST_URL);
	console.log(`✅ HTTP ${page.httpStatus} | ${page.contentLength} bytes`);

	const content = extractContent(page.html, TEST_URL);
	console.log(`📄 ${content.wordCount} words | ratio ${content.textHtmlRatio}`);
	console.log(
		`   Headings: h1=${content.headingStructure.h1.length}, h2=${content.headingStructure.h2.length}`,
	);
	console.log(
		`   Images: ${content.imagesWithAlt}/${content.imagesTotal} with alt`,
	);
	console.log(
		`   Links: ${content.internalLinks} internal, ${content.externalLinks} external`,
	);
	console.log(`   DOM depth: ${content.domDepthAvg}`);
} catch (err) {
	console.error(`❌ Failed:`, err instanceof Error ? err.message : err);
	process.exit(1);
}
