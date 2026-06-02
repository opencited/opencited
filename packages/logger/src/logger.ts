import type { LogLevel, Logger, LoggerContext, Transport } from "./types";
import { env } from "./env";

function extractContext(...args: unknown[]): Record<string, unknown> {
	const ctx: Record<string, unknown> = {};
	for (const arg of args) {
		if (arg && typeof arg === "object") {
			Object.assign(ctx, arg);
		}
	}
	return ctx;
}

function buildLogger(
	transports: Transport[],
	minLevel: LogLevel,
	context: LoggerContext,
): Logger {
	const ctxEntries = Object.entries(context).filter(([, v]) => v !== undefined);
	const ctxObj = Object.fromEntries(ctxEntries);

	function dispatch(
		level: LogLevel,
		message: string,
		...args: unknown[]
	): void {
		if (level === "off") return;

		const hierarchy: Record<LogLevel, number> = {
			off: 0,
			error: 1,
			warn: 2,
			info: 3,
			debug: 4,
		};

		if (hierarchy[level] < hierarchy[minLevel]) return;

		const mergedCtx = { ...ctxObj, ...extractContext(...args) };

		for (const transport of transports) {
			try {
				transport.log(level, message, mergedCtx);
			} catch (err) {
				console.error("[Logger] Transport error:", err);
			}
		}
	}

	return {
		info: (msg, ...args) => dispatch("info", msg, ...args),
		warn: (msg, ...args) => dispatch("warn", msg, ...args),
		error: (msg, ...args) => dispatch("error", msg, ...args),
		debug: (msg, ...args) => dispatch("debug", msg, ...args),
		withContext: (newCtx: LoggerContext) =>
			buildLogger(transports, minLevel, { ...context, ...newCtx }),
		flush: async () => {
			await Promise.all(
				transports
					.filter((t): t is Transport & { flush: () => Promise<void> } =>
						Boolean(t.flush),
					)
					.map((t) => t.flush()),
			);
		},
	};
}

export interface CreateLoggerOptions {
	level?: LogLevel;
	transports?: Transport[];
}

export function createLogger(options?: CreateLoggerOptions): Logger {
	const level = options?.level ?? env.LOGGER_LEVEL;
	const transports = options?.transports ?? createDefaultTransports(level);

	return buildLogger(transports, level, {});
}

function createDefaultTransports(level: LogLevel): Transport[] {
	const transports: Transport[] = [];

	if (env.AXIOM_TRANSPORT_ENABLED) {
		const { AxiomTransport } = require("./transports/axiom");
		transports.push(new AxiomTransport({ level }));
	}

	const { ConsoleTransport } = require("./transports/console");
	const isProd = process.env.NODE_ENV === "production";
	transports.push(new ConsoleTransport({ level, pretty: !isProd }));

	return transports;
}

export { ConsoleTransport, AxiomTransport } from "./transports";
export type { LogLevel, Logger, LoggerContext, Transport } from "./types";

export const defaultLogger = createLogger();

export async function flush(): Promise<void> {
	await defaultLogger.flush();
}
