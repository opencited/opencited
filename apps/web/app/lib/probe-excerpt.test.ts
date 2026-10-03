import { describe, expect, test } from "bun:test";
import {
	formatProbeExcerpt,
	stripProbeMarkdown,
	truncateAtWordBoundary,
} from "./probe-excerpt";

describe("stripProbeMarkdown", () => {
	test("removes bold and link syntax", () => {
		const input = "**conversational** tools [formester](https://formester.com)";
		expect(stripProbeMarkdown(input)).toBe("conversational tools formester");
	});
});

describe("truncateAtWordBoundary", () => {
	test("truncates on a word boundary", () => {
		const text = "one two three four five six";
		expect(truncateAtWordBoundary(text, 14)).toBe("one two three…");
	});
});

describe("formatProbeExcerpt", () => {
	test("marks long excerpts as truncated when collapsed", () => {
		const raw = `**${"word ".repeat(40)}**`;
		const { isTruncated, preview } = formatProbeExcerpt(raw, false);
		expect(isTruncated).toBe(true);
		expect(preview.endsWith("…")).toBe(true);
	});
});
