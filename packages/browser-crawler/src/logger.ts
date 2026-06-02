import { env } from "./env";

export type LogLevel = "silent" | "info" | "debug";

export interface LoggerContext {
	jobId?: string;
	promptQueryCrawlId?: string;
	promptQueryId?: string;
	provider?: string;
}

export interface Logger {
	info(message: string, ...args: unknown[]): void;
	warn(message: string, ...args: unknown[]): void;
	error(message: string, ...args: unknown[]): void;
	debug(message: string, ...args: unknown[]): void;
	withContext(ctx: LoggerContext): Logger;
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

	function buildLogger(context: LoggerContext): Logger {
		const ctxEntries = Object.entries(context).filter(
			([, v]) => v !== undefined,
		);
		const ctxObj = Object.fromEntries(ctxEntries);

		const hasContext = ctxEntries.length > 0;

		return {
			info: (msg, ...args) => {
				if (shouldLog.info) {
					console.log(hasContext ? { ...ctxObj, msg } : msg, ...args);
				}
			},
			warn: (msg, ...args) => {
				if (shouldLog.warn) {
					console.warn(hasContext ? { ...ctxObj, msg } : msg, ...args);
				}
			},
			error: (msg, ...args) => {
				if (shouldLog.error) {
					console.error(hasContext ? { ...ctxObj, msg } : msg, ...args);
				}
			},
			debug: (msg, ...args) => {
				if (shouldLog.debug) {
					console.debug(hasContext ? { ...ctxObj, msg } : msg, ...args);
				}
			},
			withContext: (newCtx: LoggerContext) =>
				buildLogger({ ...context, ...newCtx }),
		};
	}

	return buildLogger({});
}

export const defaultLogger = createLogger(env.LOGGER_LEVEL);
