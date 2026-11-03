import { sql } from "drizzle-orm";
import { check, integer, pgTable, text } from "drizzle-orm/pg-core";
import {
	createInsertSchema,
	createSelectSchema,
	createUpdateSchema,
} from "drizzle-orm/zod";
import { z } from "zod";
import { createdAt, updatedAt } from "./common-fields";
import { crawlProviderEnum } from "./promptQueryCrawl";

export const answerEngineStatusEnum = z.enum(["enabled", "disabled"]);
export type AnswerEngineStatus = z.infer<typeof answerEngineStatusEnum>;

export const answerEngineTable = pgTable(
	"answer_engine",
	{
		key: text("key").primaryKey(),
		displayName: text("display_name").notNull(),
		status: text("status").notNull().default("enabled"),
		disabledReason: text("disabled_reason"),
		sortOrder: integer("sort_order").notNull().default(0),
		createdAt,
		updatedAt,
	},
	(table) => [
		check(
			"answer_engine_status_check",
			sql`${table.status} in ('enabled', 'disabled')`,
		),
	],
);

export const answerEngineSelectSchema = createSelectSchema(answerEngineTable);
export const answerEngineBaseInsertSchema =
	createInsertSchema(answerEngineTable);
export const answerEngineInsertSchema = answerEngineBaseInsertSchema.extend({
	key: crawlProviderEnum,
	displayName: z.string().min(1),
	status: answerEngineStatusEnum.optional(),
	disabledReason: z.string().nullable().optional(),
	sortOrder: z.number().int().optional(),
});
export const answerEngineUpdateSchema = createUpdateSchema(answerEngineTable);
