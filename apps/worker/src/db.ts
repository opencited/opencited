import { getFreshDbInstance, type Db } from "@opencited/db";

export async function withDb<T>(fn: (db: Db) => Promise<T>): Promise<T> {
	const db = getFreshDbInstance();
	return fn(db);
}
