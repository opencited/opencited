import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
	throw new Error("DATABASE_URL environment variable is not set");
}

const pool = new Pool({ connectionString: databaseUrl });
const db = drizzle({ client: pool, schema });

export { db, schema };
export {
	domainProjectTable,
	domainProjectSelectSchema,
	domainProjectBaseInsertSchema,
	domainProjectInsertSchema,
	domainProjectUpdateSchema,
} from "./schema/domainProject";
export {
	sitemapTable,
	sitemapSelectSchema,
	sitemapBaseInsertSchema,
	sitemapInsertSchema,
	sitemapUpdateSchema,
} from "./schema/sitemap";
export {
	sitemapUrlTable,
	sitemapUrlSelectSchema,
	sitemapUrlBaseInsertSchema,
	sitemapUrlInsertSchema,
	sitemapUrlUpdateSchema,
} from "./schema/sitemapUrl";
