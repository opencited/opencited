export type LogLevel = "silent" | "info" | "debug";

export interface Logger {
	info(message: string, ...args: unknown[]): void;
	warn(message: string, ...args: unknown[]): void;
	error(message: string, ...args: unknown[]): void;
	debug(message: string, ...args: unknown[]): void;
}

export function createLogger(level: LogLevel = "info"): Logger {
	const validLevels: LogLevel[] = ["silent", "info", "debug"];
	if (!validLevels.includes(level)) {
		throw new Error(
			`Invalid logger level: "${level}". Valid levels are: ${validLevels.join(", ")}`,
		);
	}

	const shouldLog = {
		silent: { info: false, warn: false, error: true, debug: false },
		info: { info: true, warn: true, error: true, debug: false },
		debug: { info: true, warn: true, error: true, debug: true },
	}[level];

	return {
		info: (msg, ...args) => {
			if (shouldLog.info) console.log(msg, ...args);
		},
		warn: (msg, ...args) => {
			if (shouldLog.warn) console.warn(msg, ...args);
		},
		error: (msg, ...args) => {
			if (shouldLog.error) console.error(msg, ...args);
		},
		debug: (msg, ...args) => {
			if (shouldLog.debug) console.debug(msg, ...args);
		},
	};
}

export const defaultLogger = createLogger(
	(process.env.LOGGER_LEVEL as LogLevel) || "info",
);
