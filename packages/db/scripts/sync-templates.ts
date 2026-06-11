import "dotenv/config";
import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { eq } from "drizzle-orm";
import { promptTemplateTable } from "../src/schema/promptTemplate";
import { promptTemplates } from "../src/prompt-templates";
import { env } from "../src/env";

async function syncTemplates() {
	neonConfig.webSocketConstructor = ws;

	const pool = new Pool({ connectionString: env.DATABASE_URL });
	const db = drizzle({ client: pool, schema: {} });

	console.log(`Syncing ${promptTemplates.length} prompt templates...`);

	let inserted = 0;
	let updated = 0;

	for (const template of promptTemplates) {
		const existing = await db
			.select({ id: promptTemplateTable.id })
			.from(promptTemplateTable)
			.where(eq(promptTemplateTable.id, template.id))
			.limit(1);

		if (existing.length === 0) {
			await db.insert(promptTemplateTable).values({
				id: template.id,
				title: template.title,
				description: template.description,
				text: template.text,
				industry: template.industry,
				category: template.category,
				tags: template.tags,
			});
			inserted++;
			console.log(`  + Inserted: ${template.id}`);
		} else {
			await db
				.update(promptTemplateTable)
				.set({
					title: template.title,
					description: template.description,
					text: template.text,
					industry: template.industry,
					category: template.category,
					tags: template.tags,
					updatedAt: new Date(),
				})
				.where(eq(promptTemplateTable.id, template.id));
			updated++;
			console.log(`  ~ Updated: ${template.id}`);
		}
	}

	console.log(`\nDone. Inserted: ${inserted}, Updated: ${updated}`);

	await pool.end();
}

syncTemplates().catch((err) => {
	console.error("Failed to sync templates:", err);
	process.exit(1);
});
