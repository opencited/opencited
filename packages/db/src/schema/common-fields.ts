import { text, timestamp } from "drizzle-orm/pg-core";

export const id = text("id")
	.primaryKey()
	.$defaultFn(() => crypto.randomUUID())
	.unique();

export const createdAt = timestamp("created_at", { withTimezone: true })
	.notNull()
	.defaultNow();

export const updatedAt = timestamp("updated_at", { withTimezone: true })
	.notNull()
	.defaultNow()
	.$onUpdate(() => new Date());
