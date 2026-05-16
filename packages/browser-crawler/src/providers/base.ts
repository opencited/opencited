import type { BrowserSession } from "../types";
import type { CrawlResult, AuthCredentials } from "./types";

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
}
