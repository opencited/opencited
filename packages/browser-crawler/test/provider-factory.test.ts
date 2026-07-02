import { describe, expect, it } from "bun:test";
import { createProvider, providerRegistry } from "../src/providers/factory";
import { PerplexityProvider } from "../src/providers/perplexity";
import { ChatGPTProvider } from "../src/providers/chatgpt";

describe("createProvider", () => {
	it("returns a PerplexityProvider instance when name is 'perplexity'", () => {
		const provider = createProvider("perplexity");
		expect(provider).toBeInstanceOf(PerplexityProvider);
	});

	it("returns a ChatGPTProvider instance when name is 'chatgpt'", () => {
		const provider = createProvider("chatgpt");
		expect(provider).toBeInstanceOf(ChatGPTProvider);
	});

	it("throws an Error listing registered providers when name is unknown", () => {
		expect(() => createProvider("nonexistent")).toThrow(Error);
		const registered = Object.keys(providerRegistry);
		for (const name of registered) {
			expect(() => createProvider("nonexistent")).toThrow(name);
		}
	});
});
