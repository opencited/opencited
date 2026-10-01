import { describe, expect, it } from "bun:test";
import { AI_AGENTS, findBlockedAgents, parseRobots } from "../src";

describe("parseRobots", () => {
	it("extracts sitemap declarations", () => {
		const robots = parseRobots(
			"User-agent: *\nAllow: /\nSitemap: https://example.com/sitemap.xml\n# comment\nSitemap: https://example.com/other.xml\n",
		);
		expect(robots.sitemaps).toEqual([
			"https://example.com/sitemap.xml",
			"https://example.com/other.xml",
		]);
	});

	it("strips inline comments from values", () => {
		const robots = parseRobots(
			"Sitemap: https://example.com/sitemap.xml # ours\n",
		);
		expect(robots.sitemaps).toEqual(["https://example.com/sitemap.xml"]);
	});

	it("groups consecutive user-agent lines with their rules", () => {
		const robots = parseRobots(
			"User-agent: GPTBot\nUser-agent: ClaudeBot\nDisallow: /\n\nUser-agent: *\nAllow: /\n",
		);
		expect(robots.groups).toHaveLength(2);
		expect(robots.groups[0]?.agents).toEqual(["gptbot", "claudebot"]);
		expect(robots.groups[0]?.rules).toEqual([{ type: "disallow", path: "/" }]);
		expect(robots.groups[1]?.agents).toEqual(["*"]);
	});

	it("ignores empty disallow directives", () => {
		const robots = parseRobots("User-agent: *\nDisallow:\nAllow: /\n");
		expect(robots.groups[0]?.rules).toEqual([{ type: "allow", path: "/" }]);
	});

	it("returns empty results for empty input", () => {
		const robots = parseRobots("");
		expect(robots.groups).toEqual([]);
		expect(robots.sitemaps).toEqual([]);
	});
});

describe("findBlockedAgents", () => {
	it("detects site-wide disallow for a specific AI agent", () => {
		const robots = parseRobots(
			"User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nAllow: /\n",
		);
		expect(findBlockedAgents(robots)).toEqual(["GPTBot"]);
	});

	it("does not block when Allow: / overrides Disallow: /", () => {
		const robots = parseRobots(
			"User-agent: PerplexityBot\nDisallow: /\nAllow: /\n",
		);
		expect(findBlockedAgents(robots)).toEqual([]);
	});

	it("blocks every tracked agent on a wildcard disallow", () => {
		const robots = parseRobots("User-agent: *\nDisallow: /\n");
		const blocked = findBlockedAgents(robots);
		expect(blocked).toHaveLength(AI_AGENTS.length);
		expect(blocked).toContain("GPTBot");
		expect(blocked).toContain("ClaudeBot");
		expect(blocked).toContain("PerplexityBot");
	});

	it("does not block on partial disallow rules", () => {
		const robots = parseRobots("User-agent: GPTBot\nDisallow: /private\n");
		expect(findBlockedAgents(robots)).toEqual([]);
	});

	it("does not block agents with no matching group", () => {
		const robots = parseRobots("User-agent: *\nAllow: /\n");
		expect(findBlockedAgents(robots)).toEqual([]);
	});

	it("matches agent names case-insensitively", () => {
		const robots = parseRobots("User-agent: gptbot\nDisallow: /\n");
		expect(findBlockedAgents(robots)).toEqual(["GPTBot"]);
	});

	it("matches token substrings of longer agent names", () => {
		const robots = parseRobots("User-agent: ClaudeBot-Internal\nDisallow: /\n");
		expect(findBlockedAgents(robots)).toContain("ClaudeBot");
	});
});
