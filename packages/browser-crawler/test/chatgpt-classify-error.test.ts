import { describe, expect, it } from "bun:test";
import { ChatGPTProvider } from "../src/providers/chatgpt";

describe("ChatGPTProvider.classifyError", () => {
	const provider = new ChatGPTProvider();

	it("classifies 'ProseMirror editor not found' as no_editor", () => {
		const error = new Error(
			'ProseMirror editor #prompt-textarea not found. URL: https://chatgpt.com, Title: "ChatGPT"',
		);
		expect(provider.classifyError(error)).toBe("no_editor");
	});

	it("classifies 'Google sign-in modal not dismissed' as logged_out", () => {
		const error = new Error(
			"Google sign-in modal not dismissed — ChatGPT requires authentication",
		);
		expect(provider.classifyError(error)).toBe("logged_out");
	});

	it("classifies 'Response stability timeout' as timeout", () => {
		const error = new Error(
			"Response stability timeout — content did not stabilize within 90s",
		);
		expect(provider.classifyError(error)).toBe("timeout");
	});

	it("classifies unrecognized errors as unknown", () => {
		const error = new Error("Something completely unexpected happened");
		expect(provider.classifyError(error)).toBe("unknown");
	});

	it("classifies errors with cause containing provider-specific patterns", () => {
		const error = new Error("Operation failed");
		error.cause = new Error("Google sign-in popup appeared");
		expect(provider.classifyError(error)).toBe("logged_out");
	});
});
