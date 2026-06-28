import type { BrowserSession } from "../types";
import type { CrawlerProvider } from "./base";
import type { CrawlResult } from "./types";
import type { FailureType } from "../errors";

export class ChatGPTProvider implements CrawlerProvider {
	readonly name = "chatgpt";
	readonly requiresAuth = false;

	async navigate(_session: BrowserSession): Promise<void> {
		throw new Error("Not implemented yet");
	}

	async submitQuery(_session: BrowserSession, _query: string): Promise<void> {
		throw new Error("Not implemented yet");
	}

	async waitForResponse(_session: BrowserSession): Promise<void> {
		throw new Error("Not implemented yet");
	}

	async extractResult(_session: BrowserSession): Promise<CrawlResult> {
		throw new Error("Not implemented yet");
	}

	classifyError(error: Error): FailureType {
		const msg = error.message.toLowerCase();
		const causeMsg =
			error.cause instanceof Error
				? error.cause.message.toLowerCase()
				: typeof error.cause === "string"
					? error.cause.toLowerCase()
					: "";
		const combined = `${msg} ${causeMsg}`;

		if (
			combined.includes("prosemirror editor") &&
			combined.includes("not found")
		)
			return "no_editor";
		if (combined.includes("google sign-in")) return "logged_out";
		if (combined.includes("response stability timeout")) return "timeout";

		return "unknown";
	}
}
