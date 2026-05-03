import { pgTable, text, integer, jsonb } from "drizzle-orm/pg-core";
import { z } from "zod";
import {
	createSelectSchema,
	createInsertSchema,
	createUpdateSchema,
} from "drizzle-orm/zod";
import { id, createdAt } from "./common-fields";
import { crawledPageTable } from "./crawledPage";

export const toneEnum = z.enum([
	"Professional",
	"Casual",
	"Technical",
	"Conversational",
	"Neutral",
]);
export const sentimentEnum = z.enum(["Positive", "Negative", "Neutral"]);
export const subjectivityEnum = z.enum([
	"Factual",
	"Opinion",
	"Mixed",
	"Promotional",
]);
export const perceivedPageTypeEnum = z.enum([
	"News article",
	"Opinion",
	"Listicle",
	"How-to",
	"Review",
	"Comparison",
	"Case study",
	"Interview",
	"Video",
	"Podcast",
	"Infographic",
	"Research paper",
	"Report",
	"Documentation",
	"Wiki",
	"Product page",
	"Landing page",
	"Forum post",
	"Social post",
	"Comment",
	"Q&A",
	"Press release",
	"FAQ",
	"Glossary",
	"Other",
]);
export const perceivedIntentEnum = z.enum([
	"Informational",
	"Transactional",
	"Navigational",
	"Commercial investigation",
]);
export const perceivedAudienceEnum = z.enum([
	"B2B",
	"B2C",
	"Both",
	"Internal",
	"Unknown",
]);
export const verbTenseEnum = z.enum(["Past", "Present", "Future"]);
export const entityTypeEnum = z.enum([
	"Person",
	"Organization",
	"Location",
	"Product",
	"Event",
	"Date",
	"Money",
	"Percent",
	"Technology",
	"Brand",
	"Other",
]);

export const namedEntitySchema = z.object({
	type: entityTypeEnum,
	name: z.string(),
});
export type NamedEntity = z.infer<typeof namedEntitySchema>;

export const headingStructureSchema = z.object({
	h1: z.array(z.string()),
	h2: z.array(z.string()),
	h3: z.array(z.string()),
	h4: z.array(z.string()),
	h5: z.array(z.string()),
	h6: z.array(z.string()),
});
export type HeadingStructure = z.infer<typeof headingStructureSchema>;

export const pageAnalysisTable = pgTable("page_analysis", {
	id: id,
	crawledPageId: text("crawled_page_id")
		.references(() => crawledPageTable.id)
		.notNull(),
	analyzedAt: text("analyzed_at"),

	wordCount: integer("word_count"),
	textHtmlRatio: text("text_html_ratio"),
	headingStructure: jsonb("heading_structure").$type<HeadingStructure>(),
	imagesTotal: integer("images_total"),
	imagesWithAlt: integer("images_with_alt"),
	internalLinks: integer("internal_links"),
	externalLinks: integer("external_links"),
	domDepthAvg: text("dom_depth_avg"),

	tone: text("tone"),
	sentiment: text("sentiment"),
	sentimentScore: integer("sentiment_score"),
	subjectivity: text("subjectivity"),
	perceivedPageType: text("perceived_page_type"),
	perceivedIntent: text("perceived_intent"),
	perceivedAudience: text("perceived_audience"),
	namedEntities: jsonb("named_entities").$type<NamedEntity[]>(),
	verbTense: text("verb_tense"),

	extractedText: text("extracted_text"),
	createdAt: createdAt,
});

export const pageAnalysisSelectSchema = createSelectSchema(pageAnalysisTable);
export const pageAnalysisBaseInsertSchema =
	createInsertSchema(pageAnalysisTable);

export const pageAnalysisInsertSchema = pageAnalysisBaseInsertSchema.extend({
	crawledPageId: z.string().uuid(),
	analyzedAt: z.string().optional(),
	wordCount: z.number().int().nonnegative().optional(),
	textHtmlRatio: z.string().optional(),
	headingStructure: headingStructureSchema.optional(),
	imagesTotal: z.number().int().nonnegative().optional(),
	imagesWithAlt: z.number().int().nonnegative().optional(),
	internalLinks: z.number().int().nonnegative().optional(),
	externalLinks: z.number().int().nonnegative().optional(),
	domDepthAvg: z.string().optional(),
	tone: toneEnum.optional(),
	sentiment: sentimentEnum.optional(),
	sentimentScore: z.number().int().min(1).max(100).optional(),
	subjectivity: subjectivityEnum.optional(),
	perceivedPageType: perceivedPageTypeEnum.optional(),
	perceivedIntent: perceivedIntentEnum.optional(),
	perceivedAudience: perceivedAudienceEnum.optional(),
	namedEntities: z.array(namedEntitySchema).optional(),
	verbTense: verbTenseEnum.optional(),
	extractedText: z.string().optional(),
});

export const pageAnalysisUpdateSchema = createUpdateSchema(pageAnalysisTable);
