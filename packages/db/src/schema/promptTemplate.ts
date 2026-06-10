import { pgTable, text, jsonb } from "drizzle-orm/pg-core";
import { z } from "zod";
import {
	createSelectSchema,
	createInsertSchema,
	createUpdateSchema,
} from "drizzle-orm/zod";
import { createdAt, updatedAt } from "./common-fields";

export const promptTemplateIndustryEnum = z.enum([
	"SaaS",
	"E-commerce",
	"Healthcare",
	"Finance",
	"Media & Publishing",
	"Education",
	"Travel & Hospitality",
	"Real Estate",
	"Legal Services",
	"Marketing & Advertising",
]);
export type PromptTemplateIndustry = z.infer<typeof promptTemplateIndustryEnum>;

export const promptTemplateCategoryEnum = z.enum([
	"competitor-analysis",
	"brand-monitoring",
	"visibility",
	"content-optimization",
	"pricing-intelligence",
	"feature-comparison",
]);
export type PromptTemplateCategory = z.infer<typeof promptTemplateCategoryEnum>;

export const promptTemplateTable = pgTable("prompt_template", {
	id: text("id").primaryKey().unique(),
	title: text("title").notNull(),
	description: text("description").notNull(),
	text: text("text").notNull(),
	industry: text("industry").notNull(),
	category: text("category").notNull(),
	tags: jsonb("tags").notNull().default("[]"),
	createdAt: createdAt,
	updatedAt: updatedAt,
});

export const promptTemplateSelectSchema = createSelectSchema(
	promptTemplateTable,
	{
		industry: promptTemplateIndustryEnum,
		category: promptTemplateCategoryEnum,
		tags: z.array(z.string()),
	},
);

export const promptTemplateBaseInsertSchema = createInsertSchema(
	promptTemplateTable,
	{
		industry: promptTemplateIndustryEnum,
		category: promptTemplateCategoryEnum,
		tags: z.array(z.string()),
	},
);

export const promptTemplateInsertSchema = promptTemplateBaseInsertSchema.extend(
	{
		id: z.string().min(1, "ID is required"),
		title: z.string().min(1, "Title is required"),
		text: z.string().min(1, "Text is required"),
		industry: promptTemplateIndustryEnum,
		category: promptTemplateCategoryEnum,
		tags: z.array(z.string()).default([]),
	},
);

export const promptTemplateUpdateSchema =
	createUpdateSchema(promptTemplateTable);
