import { describe, expect, it } from "bun:test";
import { isLevelEnabled } from "../src/levels";
import type { LogLevel } from "../src/types";

const levels: LogLevel[] = ["debug", "info", "warn", "error", "off"];

const enabledLevels: Record<LogLevel, LogLevel[]> = {
	off: [],
	error: ["error"],
	warn: ["error", "warn"],
	info: ["error", "warn", "info"],
	debug: ["error", "warn", "info", "debug"],
};

describe("isLevelEnabled", () => {
	for (const minLevel of levels) {
		for (const level of levels) {
			const expected = enabledLevels[minLevel].includes(level);

			it(`returns ${expected} for message level "${level}" with min level "${minLevel}"`, () => {
				expect(isLevelEnabled(level, minLevel)).toBe(expected);
			});
		}
	}
});
