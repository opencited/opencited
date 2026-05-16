import { locals, tasks, logger } from "@trigger.dev/sdk/v3";
import { db, type Db } from "@opencited/db";

const DbLocal = locals.create<Db>("db");

export function getDb(): Db {
	return locals.getOrThrow(DbLocal);
}

tasks.middleware("db", async ({ next }) => {
	logger.info("🔌 Initializing database connection");
	locals.set(DbLocal, db);
	await next();
	logger.info("🔌 Database connection closed");
});
