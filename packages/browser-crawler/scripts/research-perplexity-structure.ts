#!/usr/bin/env bun
/**
 * Research script to explore the full Perplexity result page structure
 * for the ConvoForm brand. This captures:
 * - Full page HTML structure
 * - Source citations
 * - Brand mentions
 * - Response sections
 * - All interactive elements
 */

import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";

const OUTPUT_DIR = path.join(import.meta.dir, ".research-output");
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

async function main() {
	const browser = await chromium.launch({ headless: false });
	const context = await browser.newContext({
		permissions: ["clipboard-read", "clipboard-write"],
		viewport: { width: 1920, height: 1080 },
	});
	const page = await context.newPage();

	console.log("🔍 Navigating to Perplexity...");
	await page.goto("https://www.perplexity.ai/", {
		waitUntil: "domcontentloaded",
		timeout: 30000,
	});
	await page.waitForLoadState("networkidle").catch(() => {});
	await page.waitForTimeout(2000);

	console.log("✍️  Submitting query for ConvoForm...");
	await page.fill(
		"#ask-input",
		"ConvoForm.com AI conversational forms platform review and competitors",
	);
	await page.keyboard.press("Enter");

	console.log("⏳ Waiting for response to load...");
	await page.waitForTimeout(10000);

	// Wait for copy button to ensure response is fully loaded
	try {
		await page.waitForSelector('button[aria-label="Copy"]', { timeout: 15000 });
		console.log("✅ Response loaded (copy button found)");
	} catch {
		console.log("⚠️  Copy button not found, proceeding anyway");
	}

	await page.waitForTimeout(3000);

	// ========================================
	// 1. CAPTURE FULL PAGE HTML
	// ========================================
	console.log("\n📄 Capturing full page HTML...");
	const fullHtml = await page.content();
	const htmlFile = path.join(OUTPUT_DIR, "full-page.html");
	fs.writeFileSync(htmlFile, fullHtml, "utf-8");
	console.log(`   Saved to: ${htmlFile}`);

	// ========================================
	// 2. EXTRACT PAGE STRUCTURE ANALYSIS
	// ========================================
	console.log("\n🔍 Analyzing page structure...");
	const structureAnalysis = await page.evaluate(() => {
		const results: Record<string, any> = {};

		// Get all top-level sections
		const allSections = Array.from(
			document.querySelectorAll("main > *, article > *, [role='main'] > *"),
		);
		results.topLevelSections = allSections.map((el, i) => ({
			index: i,
			tag: el.tagName,
			className: (el.className || "").substring(0, 150),
			id: el.id,
			textPreview: (el.textContent || "").substring(0, 200),
			childCount: el.children.length,
		}));

		// Find source/citation containers
		const sourceContainers = Array.from(
			document.querySelectorAll(
				'[class*="source"], [class*="citation"], [class*="reference"]',
			),
		);
		results.sourceContainers = sourceContainers.map((el) => ({
			tag: el.tagName,
			className: (el.className || "").substring(0, 150),
			text: (el.textContent || "").substring(0, 300),
			children: Array.from(el.children).map((c) => ({
				tag: c.tagName,
				className: (c.className || "").substring(0, 100),
				text: (c.textContent || "").substring(0, 150),
			})),
		}));

		// Find all links (grouped by context)
		const allLinks = Array.from(document.querySelectorAll("a[href]"));
		const internalLinks = allLinks.filter((a) =>
			a.href.includes("perplexity.ai"),
		);
		const externalLinks = allLinks.filter(
			(a) => !a.href.includes("perplexity.ai"),
		);

		results.linkSummary = {
			total: allLinks.length,
			internal: internalLinks.length,
			external: externalLinks.length,
		};

		results.externalLinks = externalLinks.slice(0, 50).map((a) => ({
			href: a.href,
			text: (a.textContent || "").trim().substring(0, 100),
			parentTag: a.parentElement?.tagName,
			parentClass: (a.parentElement?.className || "").substring(0, 100),
		}));

		// Find the main answer/response text area
		const possibleAnswerSelectors = [
			'[class*="answer"]',
			'[class*="response"]',
			'[class*="content"]',
			'[class*="prose"]',
			"article",
			"main",
		];

		for (const selector of possibleAnswerSelectors) {
			const el = document.querySelector(selector);
			if (el?.textContent && el.textContent.length > 100) {
				results.answerElement = {
					selector,
					tag: el.tagName,
					className: (el.className || "").substring(0, 150),
					textLength: el.textContent.length,
					textPreview: el.textContent.substring(0, 500),
					htmlPreview: el.innerHTML.substring(0, 2000),
				};
				break;
			}
		}

		// Find all heading elements
		const headings = Array.from(
			document.querySelectorAll("h1, h2, h3, h4, h5, h6"),
		);
		results.headings = headings.map((h) => ({
			level: h.tagName,
			text: h.textContent?.trim(),
			className: (h.className || "").substring(0, 100),
		}));

		// Find tables (structured data)
		const tables = Array.from(document.querySelectorAll("table"));
		results.tables = tables.map((t, i) => ({
			index: i,
			className: (t.className || "").substring(0, 100),
			rows: Array.from(t.querySelectorAll("tr")).length,
			textPreview: (t.textContent || "").substring(0, 500),
		}));

		// Find list items (often contain brand mentions)
		const lists = Array.from(document.querySelectorAll("ul, ol"));
		results.lists = lists.map((l, i) => ({
			index: i,
			type: l.tagName,
			className: (l.className || "").substring(0, 100),
			itemCount: l.querySelectorAll("li").length,
			textPreview: (l.textContent || "").substring(0, 500),
		}));

		return results;
	});

	const structureFile = path.join(OUTPUT_DIR, "structure-analysis.json");
	fs.writeFileSync(
		structureFile,
		JSON.stringify(structureAnalysis, null, 2),
		"utf-8",
	);
	console.log(`   Saved to: ${structureFile}`);

	// ========================================
	// 3. GET CLIPBOARD CONTENT (current method)
	// ========================================
	console.log("\n📋 Getting clipboard content...");
	try {
		await page.click('button[aria-label="Copy"]');
		await page.waitForTimeout(1000);
		const clipboardContent = await page.evaluate(() =>
			navigator.clipboard.readText(),
		);
		const clipboardFile = path.join(OUTPUT_DIR, "clipboard-content.txt");
		fs.writeFileSync(clipboardFile, clipboardContent, "utf-8");
		console.log(`   Saved to: ${clipboardFile}`);
		console.log(`   Length: ${clipboardContent.length} characters`);
	} catch (_error) {
		console.log("   ⚠️  Failed to get clipboard content");
	}

	// ========================================
	// 4. EXTRACT SPECIFIC PERPLEXITY PATTERNS
	// ========================================
	console.log("\n🎯 Extracting Perplexity-specific patterns...");
	const perplexityPatterns = await page.evaluate(() => {
		const patterns: Record<string, any> = {};

		// Look for numbered citations (like [1], [2], etc.)
		const citationPattern = /\[\d+\]/g;
		const bodyText = document.body.textContent || "";
		const citations = bodyText.match(citationPattern) || [];
		patterns.inlineCitations = citations;
		patterns.citationCount = citations.length;

		// Find elements with data attributes (often used for citations)
		const allElements = Array.from(document.querySelectorAll("*")).slice(
			0,
			500,
		);
		const elementsWithData = allElements.filter((el) => {
			return Array.from(el.attributes).some((attr) =>
				attr.name.startsWith("data-"),
			);
		});
		patterns.dataAttributes = elementsWithData.slice(0, 50).map((el) => ({
			tag: el.tagName,
			attributes: Object.fromEntries(
				Array.from(el.attributes)
					.filter((attr) => attr.name.startsWith("data-"))
					.map((attr) => [attr.name, attr.value.substring(0, 100)]),
			),
			text: (el.textContent || "").substring(0, 200),
		}));

		// Find all buttons (interactive elements)
		const buttons = Array.from(document.querySelectorAll("button"));
		patterns.buttons = buttons.map((b) => ({
			text: (b.textContent || "").trim(),
			ariaLabel: b.getAttribute("aria-label"),
			className: (b.className || "").substring(0, 100),
		}));

		// Look for source cards (Perplexity often shows source previews)
		const sourceCards = Array.from(
			document.querySelectorAll('[class*="card"], [class*="tile"]'),
		).filter((el) => {
			const text = el.textContent || "";
			return text.length > 50 && text.length < 500;
		});
		patterns.sourceCards = sourceCards.slice(0, 20).map((el) => ({
			tag: el.tagName,
			className: (el.className || "").substring(0, 150),
			text: (el.textContent || "").substring(0, 300),
			links: Array.from(el.querySelectorAll("a")).map((a) => a.href),
		}));

		return patterns;
	});

	const patternsFile = path.join(OUTPUT_DIR, "perplexity-patterns.json");
	fs.writeFileSync(
		patternsFile,
		JSON.stringify(perplexityPatterns, null, 2),
		"utf-8",
	);
	console.log(`   Saved to: ${patternsFile}`);

	// ========================================
	// 5. SUMMARY
	// ========================================
	console.log(`\n${"=".repeat(60)}`);
	console.log("📊 SUMMARY");
	console.log("=".repeat(60));
	console.log(
		`Top-level sections: ${structureAnalysis.topLevelSections?.length || 0}`,
	);
	console.log(
		`Source containers: ${structureAnalysis.sourceContainers?.length || 0}`,
	);
	console.log(`Total links: ${structureAnalysis.linkSummary?.total || 0}`);
	console.log(`  - Internal: ${structureAnalysis.linkSummary?.internal || 0}`);
	console.log(`  - External: ${structureAnalysis.linkSummary?.external || 0}`);
	console.log(`Headings: ${structureAnalysis.headings?.length || 0}`);
	console.log(`Tables: ${structureAnalysis.tables?.length || 0}`);
	console.log(`Lists: ${structureAnalysis.lists?.length || 0}`);
	console.log(`Inline citations: ${perplexityPatterns.citationCount || 0}`);
	console.log(`Source cards: ${perplexityPatterns.sourceCards?.length || 0}`);
	console.log(`Buttons: ${perplexityPatterns.buttons?.length || 0}`);

	if (structureAnalysis.answerElement) {
		console.log(
			`\n✅ Found answer element: ${structureAnalysis.answerElement.selector}`,
		);
		console.log(
			`   Text length: ${structureAnalysis.answerElement.textLength} chars`,
		);
		console.log(
			`   Preview: ${structureAnalysis.answerElement.textPreview.substring(0, 200)}...`,
		);
	}

	console.log(`\n📁 All output saved to: ${OUTPUT_DIR}`);
	console.log("   - full-page.html");
	console.log("   - structure-analysis.json");
	console.log("   - clipboard-content.txt");
	console.log("   - perplexity-patterns.json");

	await browser.close();
	console.log("\n✅ Done!");
}

main().catch((error) => {
	console.error("❌ Error:", error);
	process.exit(1);
});
