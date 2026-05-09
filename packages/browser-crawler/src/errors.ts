export class CrawlerError extends Error {
	constructor(
		message: string,
		public readonly provider: string,
		public readonly step: string,
		public readonly cause?: unknown,
	) {
		super(message);
		this.name = "CrawlerError";
	}
}

export class AuthenticationError extends CrawlerError {
	constructor(provider: string, cause?: unknown) {
		super("Authentication failed", provider, "authenticate", cause);
		this.name = "AuthenticationError";
	}
}

export class NavigationError extends CrawlerError {
	constructor(provider: string, url: string, cause?: unknown) {
		super(`Failed to navigate to ${url}`, provider, "navigate", cause);
		this.name = "NavigationError";
	}
}

export class ExtractionError extends CrawlerError {
	constructor(provider: string, cause?: unknown) {
		super("Failed to extract content", provider, "extractResult", cause);
		this.name = "ExtractionError";
	}
}
