import { describe, expect, it } from "bun:test";
import { createProvider, providerRegistry } from "../src/providers/factory";
import { PerplexityProvider } from "../src/providers/perplexity";

describe("createProvider", () => {
	it("returns a PerplexityProvider instance when name is 'perplexity'", () => {
		const provider = createProvider("perplexity");
		expect(provider).toBeInstanceOf(PerplexityProvider);
	});

	it("throws an Error listing registered providers when name is unknown", () => {
		expect(() => createProvider("nonexistent")).toThrow(Error);
		const registered = Object.keys(providerRegistry);
		for (const name of registered) {
			expect(() => createProvider("nonexistent")).toThrow(name);
		}
	});
});
