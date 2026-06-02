import type { LogLevel, Transport } from "../types";

const levelIcons: Record<LogLevel, string> = {
	debug: "🔍",
	info: "ℹ️",
	warn: "⚠️",
	error: "❌",
	off: "",
};

const levelColors: Record<LogLevel, string> = {
	debug: "\x1b[36m",
	info: "\x1b[32m",
	warn: "\x1b[33m",
	error: "\x1b[31m",
	off: "",
};

const reset = "\x1b[0m";
const dim = "\x1b[2m";
const bold = "\x1b[1m";

export class ConsoleTransport implements Transport {
	private level: LogLevel;
	private pretty: boolean;

	constructor(options?: { level?: LogLevel; pretty?: boolean }) {
		this.level = options?.level ?? "info";
		this.pretty = options?.pretty ?? true;
	}

	log(level: LogLevel, message: string, ctx: Record<string, unknown>): void {
		if (!this.shouldLog(level)) return;

		if (this.pretty) {
			this.logPretty(level, message, ctx);
		} else {
			this.logRaw(level, message, ctx);
		}
	}

	private logPretty(
		level: LogLevel,
		message: string,
		ctx: Record<string, unknown>,
	): void {
		const icon = levelIcons[level];
		const color = levelColors[level];
		const timestamp = new Date()
			.toISOString()
			.replace("T", " ")
			.replace(/\..+/, "");

		const ctxEntries = Object.entries(ctx).filter(([, v]) => v !== undefined);

		if (ctxEntries.length === 0) {
			process.stdout.write(
				`${dim}${timestamp}${reset} ${color}${icon}${reset} ${bold}${message}${reset}\n`,
			);
			return;
		}

		const ctxObj = Object.fromEntries(ctxEntries);
		const jsonStr = JSON.stringify(ctxObj, null, 2)
			.split("\n")
			.map((line) => `${dim}  ${line}${reset}`)
			.join("\n");

		process.stdout.write(
			`${dim}${timestamp}${reset} ${color}${icon}${reset} ${bold}${message}${reset}\n${jsonStr}\n`,
		);
	}

	private logRaw(
		level: LogLevel,
		message: string,
		ctx: Record<string, unknown>,
	): void {
		const hasContext = Object.keys(ctx).length > 0;
		const output = hasContext ? { ...ctx, msg: message } : message;

		switch (level) {
			case "debug":
				console.debug(output);
				break;
			case "info":
				console.log(output);
				break;
			case "warn":
				console.warn(output);
				break;
			case "error":
				console.error(output);
				break;
			case "off":
				break;
		}
	}

	private shouldLog(level: LogLevel): boolean {
		const hierarchy: Record<LogLevel, number> = {
			off: 0,
			error: 1,
			warn: 2,
			info: 3,
			debug: 4,
		};
		return (hierarchy[level] ?? 0) >= (hierarchy[this.level] ?? 0);
	}
}
