import { describe, expect, it } from "bun:test";
import {
	isDuplicatedPerplexityQuery,
	normalizePerplexityQueryText,
	perplexityBodyHasLoginWall,
} from "../src/providers/perplexity-dom";

describe("isDuplicatedPerplexityQuery", () => {
	const query =
		"What are the best Enterprise grade AI voice agents for every customer conversation tools?";

	it("detects exact doubled query", () => {
		expect(isDuplicatedPerplexityQuery(query + query, query)).toBe(true);
	});

	it("detects doubled query with only whitespace between", () => {
		expect(isDuplicatedPerplexityQuery(`${query} ${query}`, query)).toBe(true);
	});

	it("returns false for a single query", () => {
		expect(isDuplicatedPerplexityQuery(query, query)).toBe(false);
	});
});

describe("perplexityBodyHasLoginWall", () => {
	it("detects sign-up wall copy", () => {
		expect(perplexityBodyHasLoginWall("Sign up and repeat your request.")).toBe(
			true,
		);
		expect(
			perplexityBodyHasLoginWall(
				"Something went wrong. Sign up and repeat your request.",
			),
		).toBe(true);
	});
});

describe("normalizePerplexityQueryText", () => {
	it("collapses whitespace", () => {
		expect(normalizePerplexityQueryText("  hello   world  ")).toBe(
			"hello world",
		);
	});
});
