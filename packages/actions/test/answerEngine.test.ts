import { describe, expect, it } from "bun:test";
import { answerEngineTable } from "@opencited/db";
import {
	assertEngineEnabled,
	ENGINE_TEMPORARILY_UNAVAILABLE_REASON,
	ENGINE_UNAVAILABLE_REASON,
	EngineDisabledError,
	getAnswerEnginesAction,
	resolveAnswerEngines,
	selectEnginesForScore,
} from "../src/answerEngine";

const enabledChatgpt = {
	key: "chatgpt",
	displayName: "ChatGPT",
	status: "enabled",
	disabledReason: null,
	sortOrder: 10,
};

const disabledPerplexity = {
	key: "perplexity",
	displayName: "Perplexity",
	status: "disabled",
	disabledReason:
		"Perplexity is temporarily unavailable while we fix an issue with it. ChatGPT is fully working.",
	sortOrder: 20,
};

function dbWithRows(rows: Array<Record<string, unknown>>) {
	const query = {
		orderBy: () => query,
		// biome-ignore lint/suspicious/noThenProperty: the action awaits the query builder
		then: (
			resolve: (value: typeof rows) => unknown,
			reject?: (reason: unknown) => unknown,
		) => Promise.resolve(rows).then(resolve, reject),
	};
	return {
		select: () => ({
			from: (table: unknown) => {
				if (table !== answerEngineTable) {
					throw new Error("unexpected table");
				}
				return query;
			},
		}),
	};
}

describe("resolveAnswerEngines", () => {
	it("returns an enabled row and a disabled row with its reason", () => {
		const engines = resolveAnswerEngines([enabledChatgpt, disabledPerplexity]);

		expect(engines).toEqual([
			{
				key: "chatgpt",
				displayName: "ChatGPT",
				enabled: true,
				disabledReason: null,
				sortOrder: 10,
			},
			{
				key: "perplexity",
				displayName: "Perplexity",
				enabled: false,
				disabledReason: disabledPerplexity.disabledReason,
				sortOrder: 20,
			},
		]);
	});

	it("uses generic text when a disabled row has an empty reason", () => {
		const engines = resolveAnswerEngines([
			enabledChatgpt,
			{ ...disabledPerplexity, disabledReason: "   " },
		]);

		expect(engines.find((engine) => engine.key === "perplexity")).toMatchObject(
			{
				enabled: false,
				disabledReason: ENGINE_TEMPORARILY_UNAVAILABLE_REASON,
			},
		);
	});

	it("treats a missing row as disabled", () => {
		const engines = resolveAnswerEngines([enabledChatgpt]);
		const perplexity = engines.find((engine) => engine.key === "perplexity");

		expect(perplexity).toMatchObject({
			enabled: false,
			disabledReason: ENGINE_UNAVAILABLE_REASON,
			displayName: "Perplexity",
		});
	});

	it("ignores a row whose key is not a known engine", () => {
		const engines = resolveAnswerEngines([
			enabledChatgpt,
			disabledPerplexity,
			{
				key: "gemini",
				displayName: "Gemini",
				status: "enabled",
				disabledReason: null,
				sortOrder: 0,
			},
		]);

		expect(engines.map((engine) => engine.key)).toEqual([
			"chatgpt",
			"perplexity",
		]);
	});
});

describe("getAnswerEnginesAction", () => {
	it("reads rows from the database and resolves them", async () => {
		const engines = await getAnswerEnginesAction({
			input: {},
			ctx: {
				db: dbWithRows([enabledChatgpt, disabledPerplexity]),
				userId: "user-1",
				isAuthenticated: true,
			},
		});

		expect(engines[0]?.key).toBe("chatgpt");
		expect(engines[0]?.enabled).toBe(true);
		expect(engines[1]?.enabled).toBe(false);
	});
});

describe("assertEngineEnabled", () => {
	it("throws EngineDisabledError with the user-facing reason", async () => {
		const ctx = {
			db: dbWithRows([enabledChatgpt, disabledPerplexity]),
			userId: "user-1",
			isAuthenticated: true,
		};

		await expect(assertEngineEnabled(ctx, "perplexity")).rejects.toBeInstanceOf(
			EngineDisabledError,
		);

		try {
			await assertEngineEnabled(ctx, "perplexity");
		} catch (error) {
			expect(error).toBeInstanceOf(EngineDisabledError);
			if (error instanceof EngineDisabledError) {
				expect(error.key).toBe("perplexity");
				expect(error.displayName).toBe("Perplexity");
				expect(error.reason).toBe(disabledPerplexity.disabledReason);
				expect(error.message).toBe(disabledPerplexity.disabledReason);
			}
		}
	});
});

describe("selectEnginesForScore", () => {
	it("includes only enabled engines", () => {
		const engines = resolveAnswerEngines([enabledChatgpt, disabledPerplexity]);
		expect(selectEnginesForScore(engines)).toEqual({
			includedEngines: ["chatgpt"],
			scoreIncludesPausedEngines: false,
		});
	});

	it("falls back to every engine when all engines are disabled", () => {
		const engines = resolveAnswerEngines([
			{ ...enabledChatgpt, status: "disabled", disabledReason: "Paused." },
			disabledPerplexity,
		]);
		expect(selectEnginesForScore(engines)).toEqual({
			includedEngines: undefined,
			scoreIncludesPausedEngines: true,
		});
	});
});
