import { describe, expect, it } from "bun:test";
import { PerplexityProvider } from "../src/providers/perplexity";

describe("PerplexityProvider.classifyError", () => {
	const provider = new PerplexityProvider();

	it("classifies 'Search input #ask-input not found' as no_editor", () => {
		const error = new Error(
			'Search input #ask-input not found. URL: https://perplexity.ai, Title: "Perplexity"',
		);
		expect(provider.classifyError(error)).toBe("no_editor");
	});

	it("classifies 'Cloudflare challenge timeout' as bot_detection", () => {
		const error = new Error("Cloudflare challenge timeout - rotating proxy");
		expect(provider.classifyError(error)).toBe("bot_detection");
	});

	it("classifies 'Login wall detected' as logged_out", () => {
		const error = new Error(
			"Login wall detected - Perplexity requires sign-in to view answer",
		);
		expect(provider.classifyError(error)).toBe("logged_out");
	});

	it("classifies 'Login wall detected in extracted content' as logged_out", () => {
		const error = new Error(
			"Login wall detected in extracted content - Perplexity requires sign-in",
		);
		expect(provider.classifyError(error)).toBe("logged_out");
	});

	it("classifies 'Extraction failed: content too short' as extraction_failed", () => {
		const error = new Error(
			"Extraction failed: content too short (42 chars). Page may require authentication.",
		);
		expect(provider.classifyError(error)).toBe("extraction_failed");
	});

	it("classifies unrecognized errors as unknown", () => {
		const error = new Error("Something completely unexpected happened");
		expect(provider.classifyError(error)).toBe("unknown");
	});

	it("classifies errors with cause containing provider-specific patterns", () => {
		const error = new Error("Operation failed");
		error.cause = new Error("Cloudflare challenge timeout");
		expect(provider.classifyError(error)).toBe("bot_detection");
	});

	it("classifies errors with string cause", () => {
		const error = new Error("Operation failed");
		error.cause = "Login wall detected in page";
		expect(provider.classifyError(error)).toBe("logged_out");
	});
});
