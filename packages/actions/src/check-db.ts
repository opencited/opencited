#!/usr/bin/env bun
import { db } from "@opencited/db";
import { eq, desc } from "drizzle-orm";
import {
	promptQueryCrawlTable,
	crawlBrandMentionTable,
	crawlSourceTable,
	competitorTable,
} from "@opencited/db";

async function main() {
	console.log("=== RECENT CRAWL RECORDS (last 5, newest first) ===");
	const crawls = await db
		.select()
		.from(promptQueryCrawlTable)
		.orderBy(desc(promptQueryCrawlTable.createdAt))
		.limit(5);

	for (const crawl of crawls) {
		console.log(`\n--- Crawl: ${crawl.id.substring(0, 8)}... ---`);
		console.log(`  Status: ${crawl.status}`);
		console.log(`  Provider: ${crawl.provider}`);
		console.log(`  Brand mentions: ${crawl.brandMentionCount}`);
		console.log(`  Sources: ${crawl.sourceCount}`);
		console.log(`  Answer format: ${crawl.answerFormat}`);
		console.log(`  Created: ${crawl.createdAt}`);
		console.log(`  Query: ${crawl.query?.substring(0, 60)}`);

		if (crawl.brandMentionCount && crawl.brandMentionCount > 0) {
			const mentions = await db
				.select()
				.from(crawlBrandMentionTable)
				.where(eq(crawlBrandMentionTable.crawlId, crawl.id));

			console.log(`  Brand mentions detail (${mentions.length}):`);
			for (const m of mentions) {
				console.log(
					`    - ${m.brandName} (${m.mentionType}) competitorId: ${m.competitorId ?? "none"} rec: ${m.isRecommendation}`,
				);
			}
		}

		const sources = await db
			.select()
			.from(crawlSourceTable)
			.where(eq(crawlSourceTable.crawlId, crawl.id));

		console.log(`  Sources detail (${sources.length}):`);
		for (const s of sources.slice(0, 3)) {
			console.log(`    - ${s.domain} (pos: ${s.position})`);
		}
	}

	console.log("\n=== ALL COMPETITORS ===");
	const competitors = await db.select().from(competitorTable);
	console.log(`Total: ${competitors.length}`);
	for (const c of competitors) {
		console.log(`  - ${c.name} (${c.domain}) active: ${c.active}`);
	}
}

main().catch(console.error);
