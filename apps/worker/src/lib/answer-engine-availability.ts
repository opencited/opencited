import {
	type AnswerEngineAvailability,
	getAnswerEnginesAction,
} from "@opencited/actions";
import type { Db } from "@opencited/db";

/**
 * A database edit reaches this process within ANSWER_ENGINE_CACHE_TTL_MS.
 * The browser query stays fresh for 30 seconds and refetches on that same
 * interval, so a flip shows up everywhere within about 60 seconds with no
 * redeploy or restart.
 */
export const ANSWER_ENGINE_CACHE_TTL_MS = 30_000;

let cached: {
	fetchedAt: number;
	engines: AnswerEngineAvailability[];
} | null = null;

export function resetAnswerEngineAvailabilityCache() {
	cached = null;
}

export async function readAnswerEngines(
	db: Db,
): Promise<AnswerEngineAvailability[]> {
	const now = Date.now();
	if (cached && now - cached.fetchedAt < ANSWER_ENGINE_CACHE_TTL_MS) {
		return cached.engines;
	}

	const engines = await getAnswerEnginesAction({
		input: {},
		ctx: { db, userId: null, isAuthenticated: false },
	});
	cached = { fetchedAt: now, engines };
	return engines;
}
