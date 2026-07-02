import {
	pgTable,
	text,
	integer,
	boolean,
	jsonb,
	index,
} from "drizzle-orm/pg-core";
import { z } from "zod";
import {
	createSelectSchema,
	createInsertSchema,
	createUpdateSchema,
} from "drizzle-orm/zod";
import { id, createdAt, updatedAt } from "./common-fields";
import { promptQueryCrawlTable } from "./promptQueryCrawl";

export const crawlReferenceKindEnum = z.enum(["inline-link", "source-panel"]);
export type CrawlReferenceKind = z.infer<typeof crawlReferenceKindEnum>;

export const crawlReferenceTable = pgTable(
	"crawl_reference",
	{
		id: id,
		crawlId: text("crawl_id")
			.notNull()
			.references(() => promptQueryCrawlTable.id, { onDelete: "cascade" }),

		kind: text("kind").notNull(),

		domain: text("domain").notNull(),
		url: text("url").notNull(),
		title: text("title"),
		position: integer("position"),

		// Citation-only fields (null for inline-link)
		description: text("description"),
		favicon: text("favicon"),
		sourceName: text("source_name"),

		isOwnDomain: boolean("is_own_domain").notNull().default(false),
		isCompetitorDomain: boolean("is_competitor_domain")
			.notNull()
			.default(false),

		metadata: jsonb("metadata"),

		createdAt: createdAt,
		updatedAt: updatedAt,
	},
	(table) => [
		index("crawl_reference_crawl_id_domain_idx").on(
			table.crawlId,
			table.domain,
		),
	],
);

export const crawlReferenceSelectSchema =
	createSelectSchema(crawlReferenceTable);
export const crawlReferenceBaseInsertSchema =
	createInsertSchema(crawlReferenceTable);
export const crawlReferenceInsertSchema = crawlReferenceBaseInsertSchema.extend(
	{
		crawlId: z.string().min(1),
		kind: crawlReferenceKindEnum,
		domain: z.string().min(1),
		url: z.string().url(),
		title: z.string().optional(),
		position: z.number().int().optional(),
		description: z.string().optional(),
		favicon: z.string().optional(),
		sourceName: z.string().optional(),
		isOwnDomain: z.boolean().optional(),
		isCompetitorDomain: z.boolean().optional(),
		metadata: z.record(z.string(), z.unknown()).optional(),
	},
);
export const crawlReferenceUpdateSchema =
	createUpdateSchema(crawlReferenceTable);
