import {
	getFreshDbInstanceWithPool,
	type Db,
	type DbPool,
} from "@opencited/db";
import { defaultLogger } from "@opencited/logger";

export interface DbScope {
	db: Db;
	pool: DbPool;
}

/**
 * Opens a worker-scoped database connection. The caller owns the pool and
 * must close it (`withDb` does this in a `finally`).
 */
export function createDbScope(): DbScope {
	return getFreshDbInstanceWithPool({
		onPoolError: (error) => {
			// An idle Neon WebSocket can be closed by the server. The pool
			// discards the dead client, so this is recoverable: log it and keep
			// the worker alive instead of letting EventEmitter rethrow.
			defaultLogger.error("Neon pool client error", {
				error: error.message,
				stack: error.stack,
			});
		},
	});
}

/**
 * Runs `fn` with a short-lived database connection. The pool is always ended
 * afterwards so an idle WebSocket is never held open across a browser crawl
 * or LLM wait.
 */
export async function withDb<T>(
	fn: (db: Db) => Promise<T>,
	createScope: () => DbScope = createDbScope,
): Promise<T> {
	const { db, pool } = createScope();

	try {
		return await fn(db);
	} finally {
		try {
			await pool.end();
		} catch (error) {
			defaultLogger.warn("Failed to close Neon pool", {
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}
}
