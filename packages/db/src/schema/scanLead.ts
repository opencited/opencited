import {
	boolean,
	integer,
	pgTable,
	text,
	timestamp,
	unique,
} from "drizzle-orm/pg-core";
import { z } from "zod";
import {
	createInsertSchema,
	createSelectSchema,
	createUpdateSchema,
} from "drizzle-orm/zod";
import { id, createdAt, updatedAt } from "./common-fields";
import { publicScanTable } from "./publicScan";

export const scanLeadTable = pgTable(
	"scan_lead",
	{
		id: id,
		email: text("email").notNull(),
		domain: text("domain").notNull(),
		publicScanId: text("public_scan_id")
			.notNull()
			.references(() => publicScanTable.id, { onDelete: "cascade" }),
		consentToOnChangeUpdates: boolean("consent_to_on_change_updates")
			.notNull()
			.default(false),
		codeHash: text("code_hash").notNull(),
		codeExpiresAt: timestamp("code_expires_at", {
			withTimezone: true,
		}).notNull(),
		attemptCount: integer("attempt_count").notNull().default(0),
		verifiedAt: timestamp("verified_at", { withTimezone: true }),
		reportSentAt: timestamp("report_sent_at", { withTimezone: true }),
		/** Set when the full report email already includes final AI visibility (ok/unavailable). */
		probeReportSentAt: timestamp("probe_report_sent_at", {
			withTimezone: true,
		}),
		createdAt: createdAt,
		updatedAt: updatedAt,
	},
	(table) => ({
		scanEmailUnique: unique("scan_lead_public_scan_email_unique").on(
			table.publicScanId,
			table.email,
		),
	}),
);

export const scanLeadSelectSchema = createSelectSchema(scanLeadTable);
export const scanLeadBaseInsertSchema = createInsertSchema(scanLeadTable);
export const scanLeadInsertSchema = scanLeadBaseInsertSchema.extend({
	email: z.string().email(),
	domain: z.string().min(1),
	publicScanId: z.string().min(1),
	consentToOnChangeUpdates: z.boolean().optional(),
	codeHash: z.string().min(1),
	codeExpiresAt: z.date(),
	attemptCount: z.number().int().min(0).optional(),
});
export const scanLeadUpdateSchema = createUpdateSchema(scanLeadTable);
