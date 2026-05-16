#!/usr/bin/env bun
/**
 * Extract detailed citation and source information from Perplexity result page
 */

import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";

const OUTPUT_DIR = path.join(import.meta.dir, ".research-output");

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

	try {
		await page.waitForSelector('button[aria-label="Copy"]', { timeout: 15000 });
		console.log("✅ Response loaded");
	} catch {
		console.log("⚠️  Copy button not found");
	}

	await page.waitForTimeout(3000);

	// ========================================
	// 1. EXTRACT INLINE CITATIONS FROM ANSWER
	// ========================================
	console.log("\n📚 Extracting inline citations...");
	const inlineCitations = await page.evaluate(() => {
		const citations: Array<{
			sourceName: string;
			sourceUrl: string;
			position: number;
			context: string;
		}> = [];

		// Find all citation elements
		const citationElements = Array.from(
			document.querySelectorAll(".citation.inline"),
		);

		citationElements.forEach((el, index) => {
			// Get the source name (e.g., "github", "g2", "capterra")
			const sourceName = el.textContent?.trim().replace(/\+\d+$/, "") || "";

			// Find parent link or data attribute with URL
			const parentLink = el.closest("a");
			const sourceUrl =
				parentLink?.href ||
				el.getAttribute("data-url") ||
				el.getAttribute("href") ||
				"";

			// Get surrounding context
			const paragraph = el.closest("p");
			const context = paragraph?.textContent?.substring(0, 200) || "";

			citations.push({
				sourceName,
				sourceUrl,
				position: index + 1,
				context,
			});
		});

		return citations;
	});

	console.log(`   Found ${inlineCitations.length} inline citations`);
	console.log(JSON.stringify(inlineCitations, null, 2));

	// ========================================
	// 2. TRY TO OPEN CITATIONS PANEL
	// ========================================
	console.log("\n🔍 Looking for citations panel...");

	// Find the "10 sources" button or similar
	const sourcesButton = await page
		.locator('button:has-text("sources")')
		.first();
	const sourcesButtonCount = await sourcesButton.count();

	if (sourcesButtonCount > 0) {
		console.log("✅ Found sources button, clicking...");
		await sourcesButton.click();
		await page.waitForTimeout(2000);

		// Extract citations from the panel
		const citationsPanel = await page.evaluate(() => {
			// Look for the citations tab content
			const citationsTab = document.querySelector('[id*="content-citations"]');

			if (!citationsTab) {
				return { found: false };
			}

			// Extract source cards
			const sourceCards = Array.from(
				citationsTab.querySelectorAll('[class*="card"], [class*="source"]'),
			).map((el) => ({
				title: el
					.querySelector("h1, h2, h3, [class*='title']")
					?.textContent?.trim(),
				url: el.querySelector("a")?.href,
				description: el
					.querySelector("[class*='description'], p")
					?.textContent?.trim(),
				domain: el.querySelector("[class*='domain']")?.textContent?.trim(),
				className: el.className,
			}));

			return {
				found: true,
				sourceCards,
				html: citationsTab.innerHTML.substring(0, 5000),
			};
		});

		console.log("Citations panel:", JSON.stringify(citationsPanel, null, 2));
	} else {
		console.log("⚠️  Sources button not found");
	}

	// ========================================
	// 3. EXTRACT ALL EXTERNAL LINKS WITH CONTEXT
	// ========================================
	console.log("\n🔗 Extracting all external links...");
	const externalLinks = await page.evaluate(() => {
		const links = Array.from(document.querySelectorAll("a[href^='http']"))
			.filter(
				(a) =>
					!a.href.includes("perplexity.ai") && !a.href.includes("google.com"),
			)
			.map((a) => ({
				href: a.href,
				text: (a.textContent || "").trim().substring(0, 100),
				parentSelector:
					a.parentElement?.tagName +
					"." +
					(a.parentElement?.className || "").substring(0, 50),
				hasCitation:
					a.closest(".citation") !== null ||
					a.querySelector(".citation") !== null,
			}));

		return links;
	});

	console.log(`   Found ${externalLinks.length} external links`);
	console.log(JSON.stringify(externalLinks.slice(0, 20), null, 2));

	// ========================================
	// 4. EXTRACT BRAND MENTIONS FROM ANSWER
	// ========================================
	console.log("\n🏢 Extracting brand mentions...");
	const brandMentions = await page.evaluate(() => {
		const answerElement = document.querySelector('[data-renderer="lm"]');
		if (!answerElement) return [];

		const text = answerElement.textContent || "";

		// Known brands to look for (this would be dynamic in production)
		const brands = [
			"ConvoForm",
			"Voiceform",
			"NoForm AI",
			"involve.me",
			"Orbit Forms",
			"Jotform",
			"Google Forms",
			"Formstack",
			"SurveyMonkey",
			"Qualtrics",
		];

		const mentions: Array<{
			brand: string;
			context: string;
			position: number;
		}> = [];

		brands.forEach((brand) => {
			const regex = new RegExp(`(.{0,100}${brand}.{0,100})`, "gi");
			let match;
			while ((match = regex.exec(text)) !== null) {
				mentions.push({
					brand,
					context: match[1].trim(),
					position: match.index,
				});
			}
		});

		return mentions;
	});

	console.log(`   Found ${brandMentions.length} brand mentions`);
	console.log(JSON.stringify(brandMentions.slice(0, 10), null, 2));

	// ========================================
	// 5. SAVE EVERYTHING
	// ========================================
	const outputFile = path.join(OUTPUT_DIR, "detailed-citations.json");
	const output = {
		inlineCitations,
		externalLinks,
		brandMentions,
		timestamp: new Date().toISOString(),
	};

	fs.writeFileSync(outputFile, JSON.stringify(output, null, 2), "utf-8");
	console.log(`\n📁 Saved to: ${outputFile}`);

	await browser.close();
	console.log("\n✅ Done!");
}

main().catch((error) => {
	console.error("❌ Error:", error);
	process.exit(1);
});
