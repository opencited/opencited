import type { BrowserSession } from "../types";
import type { CrawlResult, AuthCredentials } from "./types";
import type { FailureType } from "../errors";

export type { AuthCredentials };

export interface CrawlerProvider {
	readonly name: string;
	readonly requiresAuth: boolean;

	navigate(session: BrowserSession): Promise<void>;
	authenticate?(
		session: BrowserSession,
		credentials?: AuthCredentials,
	): Promise<void>;
	submitQuery(session: BrowserSession, query: string): Promise<void>;
	waitForResponse(session: BrowserSession): Promise<void>;
	extractResult(session: BrowserSession): Promise<CrawlResult>;
	cleanup?(session: BrowserSession): Promise<void>;
	classifyError(error: Error): FailureType;

	// Lifecycle hooks — called by the Crawler orchestrator at specific points.
	// Providers that don't need them simply omit them (the orchestrator no-ops).
	beforePrompt?(session: BrowserSession, query: string): Promise<void>;
	afterTyping?(session: BrowserSession, query: string): Promise<void>;
	beforeSubmit?(session: BrowserSession, query: string): Promise<void>;
	afterSubmit?(session: BrowserSession, query: string): Promise<void>;
	beforeRetry?(
		session: BrowserSession,
		error: Error,
		attempt: number,
	): Promise<void>;
	betweenPrompts?(session: BrowserSession, query: string): Promise<void>;
}
