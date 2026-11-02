import {
	answerEngineTable,
	type CrawlProvider,
	crawlProviderEnum,
} from "@opencited/db";
import { asc } from "drizzle-orm";
import { z } from "zod";
import { baseActionContextSchema } from "../context";

export const ENGINE_UNAVAILABLE_REASON = "This engine isn't available yet.";
export const ENGINE_TEMPORARILY_UNAVAILABLE_REASON =
	"This engine is temporarily unavailable.";

const FALLBACK_DISPLAY_NAMES: Record<CrawlProvider, string> = {
	chatgpt: "ChatGPT",
	perplexity: "Perplexity",
};

const MISSING_ROW_SORT_ORDER = 1000;

export const answerEngineAvailabilitySchema = z.object({
	key: crawlProviderEnum,
	displayName: z.string(),
	enabled: z.boolean(),
	disabledReason: z.string().nullable(),
	sortOrder: z.number(),
});

export type AnswerEngineAvailability = z.infer<
	typeof answerEngineAvailabilitySchema
>;

export class EngineDisabledError extends Error {
	readonly key: CrawlProvider;
	readonly displayName: string;
	readonly reason: string;

	constructor(
		engine: Pick<
			AnswerEngineAvailability,
			"key" | "displayName" | "disabledReason"
		>,
	) {
		const reason =
			engine.disabledReason ?? ENGINE_TEMPORARILY_UNAVAILABLE_REASON;
		super(reason);
		this.name = "EngineDisabledError";
		this.key = engine.key;
		this.displayName = engine.displayName;
		this.reason = reason;
	}
}

type AnswerEngineRow = {
	key: string;
	displayName: string;
	status: string;
	disabledReason: string | null;
	sortOrder: number;
};

function disabledReasonFromRow(row: AnswerEngineRow): string {
	const trimmed = row.disabledReason?.trim();
	if (!trimmed) return ENGINE_TEMPORARILY_UNAVAILABLE_REASON;
	return trimmed;
}

/**
 * Merge database rows with the engines that exist in code.
 * A row whose key has no adapter is ignored. An engine with no row is
 * disabled, so a new adapter cannot go live until someone inserts a row.
 */
export function resolveAnswerEngines(
	rows: AnswerEngineRow[],
): AnswerEngineAvailability[] {
	const knownKeys = new Set<string>(crawlProviderEnum.options);
	const rowByKey = new Map<string, AnswerEngineRow>();
	for (const row of rows) {
		if (!knownKeys.has(row.key)) continue;
		rowByKey.set(row.key, row);
	}

	const engines: AnswerEngineAvailability[] = crawlProviderEnum.options.map(
		(key) => {
			const row = rowByKey.get(key);
			if (!row) {
				return {
					key,
					displayName: FALLBACK_DISPLAY_NAMES[key],
					enabled: false,
					disabledReason: ENGINE_UNAVAILABLE_REASON,
					sortOrder: MISSING_ROW_SORT_ORDER,
				};
			}

			const enabled = row.status === "enabled";
			return {
				key,
				displayName: row.displayName.trim() || FALLBACK_DISPLAY_NAMES[key],
				enabled,
				disabledReason: enabled ? null : disabledReasonFromRow(row),
				sortOrder: row.sortOrder,
			};
		},
	);

	engines.sort(
		(a, b) => a.sortOrder - b.sortOrder || a.key.localeCompare(b.key),
	);
	return engines;
}

export function selectEnginesForScore(engines: AnswerEngineAvailability[]): {
	includedEngines: string[] | undefined;
	scoreIncludesPausedEngines: boolean;
} {
	const enabled = engines.filter((engine) => engine.enabled);
	if (enabled.length === 0) {
		return {
			includedEngines: undefined,
			scoreIncludesPausedEngines: true,
		};
	}
	return {
		includedEngines: enabled.map((engine) => engine.key),
		scoreIncludesPausedEngines: false,
	};
}

export const getAnswerEnginesInputSchema = z.object({});
export const getAnswerEnginesOutputSchema = z.array(
	answerEngineAvailabilitySchema,
);
export const getAnswerEnginesContextSchema = baseActionContextSchema;

/**
 * Read answer-engine availability from the database on every call.
 * Web and tRPC do not cache this. The worker may keep the result for at most
 * 30 seconds, and the browser query stays fresh for 30 seconds, so a database
 * edit shows up within about 60 seconds with no redeploy or restart.
 */
export const getAnswerEnginesAction = async (params: {
	input: z.infer<typeof getAnswerEnginesInputSchema>;
	ctx: z.infer<typeof getAnswerEnginesContextSchema>;
}) => {
	const rows = await params.ctx.db
		.select()
		.from(answerEngineTable)
		.orderBy(asc(answerEngineTable.sortOrder));

	return resolveAnswerEngines(rows);
};

export const getAnswerEnginesHandler = async (params: {
	input: z.infer<typeof getAnswerEnginesInputSchema>;
	ctx: z.infer<typeof getAnswerEnginesContextSchema>;
}) => {
	return getAnswerEnginesAction(params);
};

export async function assertEngineEnabled(
	ctx: z.infer<typeof getAnswerEnginesContextSchema>,
	key: CrawlProvider,
): Promise<AnswerEngineAvailability> {
	const engines = await getAnswerEnginesAction({ input: {}, ctx });
	const engine = engines.find((candidate) => candidate.key === key);
	if (!engine?.enabled) {
		throw new EngineDisabledError(
			engine ?? {
				key,
				displayName: FALLBACK_DISPLAY_NAMES[key],
				disabledReason: ENGINE_UNAVAILABLE_REASON,
			},
		);
	}
	return engine;
}
