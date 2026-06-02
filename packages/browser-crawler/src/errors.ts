export type FailureType =
	| "bot_detection"
	| "rate_limited"
	| "connection_error"
	| "submission_failed"
	| "no_editor"
	| "logged_out"
	| "extraction_failed"
	| "timeout"
	| "browser_crash"
	| "unknown";

export function toErrorMessage(err: unknown): string {
	if (err instanceof Error) return err.message;
	if (typeof err === "string") return err;
	return String(err);
}

export function classifyError(err: unknown): FailureType {
	const msg = toErrorMessage(err).toLowerCase();
	const causeMsg =
		err instanceof Error && err.cause
			? toErrorMessage(err.cause).toLowerCase()
			: "";
	const combined = `${msg} ${causeMsg}`;

	if (
		/err_proxy|err_connection|err_tunnel|err_ssl|err_timed_out|proxy connect failed|tunnel connection|ssl_error|pr_connect|sec_error/i.test(
			combined,
		)
	)
		return "connection_error";
	if (/browser launch timeout|proxy.*unreachable/i.test(combined))
		return "connection_error";
	if (/bot.?detect|cloudflare|captcha|turnstile|challenge/i.test(combined))
		return "bot_detection";
	if (
		/rate.?limit|too many|usage.?limit|status\s*429|403.*forbidden|access.?denied/i.test(
			combined,
		)
	)
		return "rate_limited";
	if (
		/send failed|no send button|no generation|typing failed|input has no content before submit|editor is empty before submit|submission.*failed|all submission/i.test(
			combined,
		)
	)
		return "submission_failed";
	if (
		/no.*editor|editor for .* not found|editor.*not.*ready|editor blocked by overlay|no_editor|search box not found/i.test(
			combined,
		)
	)
		return "no_editor";
	if (
		/session expired|login wall|redirected to login|logged.?out/i.test(combined)
	)
		return "logged_out";
	if (/extraction.*fail|empty.*response/i.test(combined))
		return "extraction_failed";
	if (/timed?\s*out/i.test(combined)) return "timeout";
	if (
		/window is null|protocol error|browser has been closed|target crashed|browser.*disconnect/i.test(
			combined,
		)
	)
		return "browser_crash";
	return "unknown";
}

/**
 * Returns true for failure types that warrant immediate proxy rotation.
 * Returns false for failures that should be retried on the same proxy first.
 */
export function shouldRotateProxy(failureType: FailureType): boolean {
	return (
		failureType === "bot_detection" ||
		failureType === "rate_limited" ||
		failureType === "connection_error"
	);
}

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

export class AllProxiesFailedError extends CrawlerError {
	constructor(
		public readonly proxiesAttempted: number,
		public readonly lastError: string,
		public readonly lastFailureType: FailureType = "unknown",
	) {
		super(
			`All ${proxiesAttempted} proxies failed. Last error: ${lastError}`,
			"proxy-rotation",
			"crawl",
		);
		this.name = "AllProxiesFailedError";
	}
}
