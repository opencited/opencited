import { describe, expect, it } from "bun:test";
import { ChatGPTProvider } from "../src/providers/chatgpt";

function validate(content: string): string | null {
	const provider = new ChatGPTProvider();
	return (provider as any).validateResponse(content);
}

describe("ChatGPTProvider.validateResponse", () => {
	it("rejects 'our systems have detected unusual traffic'", () => {
		expect(validate("Our systems have detected unusual traffic")).toBe(
			"our systems have detected unusual traffic",
		);
	});

	it("rejects 'please verify you're human'", () => {
		expect(validate("Please verify you're human to continue")).toBe(
			"please verify you're human",
		);
	});

	it("rejects 'too many requests'", () => {
		expect(validate("Error: Too many requests. Try again later.")).toBe(
			"too many requests",
		);
	});

	it("rejects 'service is unavailable'", () => {
		expect(validate("Sorry, the service is unavailable right now.")).toBe(
			"service is unavailable",
		);
	});

	it("rejects 'sign in to continue'", () => {
		expect(validate("You need to sign in to continue using ChatGPT.")).toBe(
			"sign in to continue",
		);
	});

	it("rejects 'access denied'", () => {
		expect(validate("Access denied. Your request has been blocked.")).toBe(
			"access denied",
		);
	});

	it("rejects 'you've been logged out'", () => {
		expect(validate("Session expired: you've been logged out.")).toBe(
			"you've been logged out",
		);
	});

	it("is case-insensitive", () => {
		expect(validate("PLEASE VERIFY YOU'RE HUMAN")).toBe(
			"please verify you're human",
		);
	});

	it("detects blocklist phrases embedded in longer content", () => {
		const content =
			"I was going to answer your question, but our systems have detected unusual traffic from your network. Please try again later.";
		expect(validate(content)).toBe("our systems have detected unusual traffic");
	});

	it("returns null for clean response content", () => {
		const content =
			"TypeScript is a typed superset of JavaScript that adds optional static typing and class-based object-oriented programming to the language. It compiles to plain JavaScript and can be used for both client-side and server-side development.";
		expect(validate(content)).toBeNull();
	});

	it("returns null for empty string", () => {
		expect(validate("")).toBeNull();
	});

	it("returns null when no blocklist phrase matches", () => {
		expect(
			validate(
				"Here are five great CRM tools for small businesses: 1. HubSpot 2. Salesforce 3. Zoho 4. Pipedrive 5. Freshsales",
			),
		).toBeNull();
	});
});
