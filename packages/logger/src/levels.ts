import type { LogLevel } from "./types";

/**
 * Severity ordering where a higher number means more verbose.
 *
 * A message is enabled when its level is at or above the configured minimum
 * verbosity, e.g. with `minLevel = "info"`, `error`, `warn` and `info` pass
 * while `debug` does not.
 */
const hierarchy: Record<LogLevel, number> = {
	off: 0,
	error: 1,
	warn: 2,
	info: 3,
	debug: 4,
};

export function isLevelEnabled(level: LogLevel, minLevel: LogLevel): boolean {
	if (level === "off" || minLevel === "off") return false;

	return hierarchy[level] <= hierarchy[minLevel];
}
