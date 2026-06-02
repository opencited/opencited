export type LogLevel = "debug" | "info" | "warn" | "error" | "off";

export interface LoggerContext {
	jobId?: string;
	promptQueryCrawlId?: string;
	promptQueryId?: string;
	provider?: string;
	[key: string]: unknown;
}

export interface Transport {
	log(level: LogLevel, message: string, ctx: Record<string, unknown>): void;
	flush?(): Promise<void>;
}

export interface Logger {
	info(message: string, ...args: unknown[]): void;
	warn(message: string, ...args: unknown[]): void;
	error(message: string, ...args: unknown[]): void;
	debug(message: string, ...args: unknown[]): void;
	withContext(ctx: LoggerContext): Logger;
	flush(): Promise<void>;
}
