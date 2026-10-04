import { pgTable, text, unique } from "drizzle-orm/pg-core";
import { z } from "zod";
import {
	createInsertSchema,
	createSelectSchema,
	createUpdateSchema,
} from "drizzle-orm/zod";
import { createdAt, id } from "./common-fields";
import { publicScanTable } from "./publicScan";

export const publicScanFunnelEventSchema = z.enum([
	"scan_started",
	"score_shown",
	"email_submitted",
	"email_verified",
	"report_viewed",
]);

export const publicScanEventTable = pgTable(
	"public_scan_event",
	{
		id: id,
		publicScanId: text("public_scan_id").references(() => publicScanTable.id, {
			onDelete: "cascade",
		}),
		event: text("event").notNull(),
		createdAt: createdAt,
	},
	(table) => ({
		scanEventUnique: unique("public_scan_event_scan_event_unique").on(
			table.publicScanId,
			table.event,
		),
	}),
);

export const publicScanEventSelectSchema =
	createSelectSchema(publicScanEventTable);
export const publicScanEventBaseInsertSchema =
	createInsertSchema(publicScanEventTable);
export const publicScanEventInsertSchema =
	publicScanEventBaseInsertSchema.extend({
		event: publicScanFunnelEventSchema,
		publicScanId: z.string().min(1).optional(),
	});
export const publicScanEventUpdateSchema =
	createUpdateSchema(publicScanEventTable);
