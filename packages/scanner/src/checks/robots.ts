export interface RobotsRule {
	type: "allow" | "disallow";
	path: string;
}

export interface RobotsGroup {
	agents: string[];
	rules: RobotsRule[];
}

export interface ParsedRobots {
	groups: RobotsGroup[];
	sitemaps: string[];
}

export interface AiAgent {
	name: string;
	tokens: string[];
}

export const AI_AGENTS: AiAgent[] = [
	{ name: "GPTBot", tokens: ["gptbot"] },
	{ name: "ChatGPT-User", tokens: ["chatgpt-user"] },
	{ name: "OAI-SearchBot", tokens: ["oai-searchbot"] },
	{ name: "ClaudeBot", tokens: ["claudebot"] },
	{ name: "anthropic-ai", tokens: ["anthropic-ai"] },
	{ name: "Claude-Web", tokens: ["claude-web"] },
	{ name: "PerplexityBot", tokens: ["perplexitybot"] },
	{ name: "Perplexity-User", tokens: ["perplexity-user"] },
	{ name: "Google-Extended", tokens: ["google-extended"] },
	{ name: "CCBot", tokens: ["ccbot"] },
	{ name: "Bytespider", tokens: ["bytespider"] },
	{ name: "Applebot-Extended", tokens: ["applebot-extended"] },
	{ name: "Meta-ExternalAgent", tokens: ["meta-externalagent"] },
	{ name: "cohere-ai", tokens: ["cohere-ai"] },
];

export function parseRobots(text: string): ParsedRobots {
	const groups: RobotsGroup[] = [];
	const sitemaps: string[] = [];
	let current: RobotsGroup | null = null;

	for (const rawLine of text.split(/\r?\n/)) {
		const line = rawLine.replace(/#.*$/, "").trim();
		if (!line) continue;
		const separator = line.indexOf(":");
		if (separator === -1) continue;
		const field = line.slice(0, separator).trim().toLowerCase();
		const value = line.slice(separator + 1).trim();

		if (field === "sitemap") {
			if (value) sitemaps.push(value);
			continue;
		}
		if (field === "user-agent") {
			if (!current || current.rules.length > 0) {
				current = { agents: [], rules: [] };
				groups.push(current);
			}
			current.agents.push(value.toLowerCase());
			continue;
		}
		if (field === "allow" || field === "disallow") {
			if (!current) {
				current = { agents: [], rules: [] };
				groups.push(current);
			}
			if (field === "disallow" && value === "") continue;
			current.rules.push({ type: field, path: value });
		}
	}

	return { groups, sitemaps };
}

function matchesAgent(group: RobotsGroup, agent: AiAgent): boolean {
	return group.agents.some((groupAgent) => {
		if (groupAgent === "*") return true;
		return agent.tokens.some((token) => groupAgent.includes(token));
	});
}

function isSiteWideDisallow(rule: RobotsRule): boolean {
	return rule.type === "disallow" && rule.path === "/";
}

export function findBlockedAgents(robots: ParsedRobots): string[] {
	const blocked: string[] = [];
	for (const agent of AI_AGENTS) {
		const matching = robots.groups.filter((group) =>
			matchesAgent(group, agent),
		);
		if (matching.length === 0) continue;
		const specific = matching.filter((group) => !group.agents.includes("*"));
		const relevant = specific.length > 0 ? specific : matching;
		const disallowed = relevant.some((group) =>
			group.rules.some(isSiteWideDisallow),
		);
		const allowed = relevant.some((group) =>
			group.rules.some(
				(rule) => rule.type === "allow" && rule.path.replace(/\/+$/, "") === "",
			),
		);
		if (disallowed && !allowed) blocked.push(agent.name);
	}
	return blocked;
}
