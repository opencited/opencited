import TurndownService from "turndown";

const turndown = new TurndownService({
	headingStyle: "atx",
	codeBlockStyle: "fenced",
	bulletListMarker: "-",
	br: "\n",
});

turndown.addRule("paragraph", {
	filter: "p",
	replacement(content) {
		return `\n\n${content}\n\n`;
	},
});

turndown.addRule("div", {
	filter: "div",
	replacement(content) {
		return `\n\n${content.trim()}\n\n`;
	},
});

turndown.addRule("heading", {
	filter: ["h1", "h2", "h3", "h4", "h5", "h6"],
	replacement(content, node) {
		const level = Number(node.nodeName.charAt(1));
		return `\n\n${"#".repeat(level)} ${content}\n\n`;
	},
});

turndown.addRule("list", {
	filter: ["ul", "ol"],
	replacement(content, node) {
		const parent = node.parentNode;
		if (
			parent &&
			(parent.nodeName === "LI" ||
				parent.nodeName === "UL" ||
				parent.nodeName === "OL")
		) {
			return `\n${content}`;
		}
		return `\n\n${content}\n\n`;
	},
});

turndown.addRule("table", {
	filter: "table",
	replacement(_content, node) {
		const table = node as HTMLTableElement;
		const rows = Array.from(table.querySelectorAll("tr"));
		if (rows.length === 0) return "";

		const result: string[] = [];
		for (let i = 0; i < rows.length; i++) {
			const row = rows[i];
			if (!row) continue;
			const cells = Array.from(row.querySelectorAll("th, td"));
			const line = cells
				.map((c) =>
					turndown
						.turndown((c as HTMLElement).innerHTML ?? c.textContent ?? "")
						.replace(/\n+/g, " ")
						.trim(),
				)
				.join(" | ");
			result.push(`| ${line} |`);
			if (i === 0) {
				result.push(`| ${cells.map(() => "---").join(" | ")} |`);
			}
		}
		return `\n\n${result.join("\n")}\n\n`;
	},
});

turndown.addRule("link", {
	filter: "a",
	replacement(content) {
		const trimmed = content.trim();
		if (!trimmed) return "";
		if (/^\[?\d+\]?$/.test(trimmed)) return "";
		return content;
	},
});

turndown.addRule("image", {
	filter: "img",
	replacement: () => "",
});
turndown.addRule("figure", {
	filter: "figure",
	replacement: () => "",
});
turndown.addRule("picture", {
	filter: "picture",
	replacement: () => "",
});
turndown.addRule("video", {
	filter: "video",
	replacement: () => "",
});
turndown.addRule("iframe", {
	filter: "iframe",
	replacement: () => "",
});

turndown.addRule("sup", {
	filter: "sup",
	replacement: () => "",
});

turndown.addRule("carousel", {
	filter(node) {
		const el = node as HTMLElement;
		const cn = el.className || "";
		return (
			el.nodeName === "DIV" &&
			(cn.includes("carousel") ||
				cn.includes("gallery") ||
				cn.includes("slider") ||
				cn.includes("swiper"))
		);
	},
	replacement: () => "",
});

turndown.addRule("code", {
	filter: ["code", "pre"],
	replacement(content, node) {
		if (node.nodeName === "PRE") {
			return `\n\n\`\`\`\n${content}\n\`\`\`\n\n`;
		}
		return `\`${content}\``;
	},
});

turndown.addRule("blockquote", {
	filter: "blockquote",
	replacement(content) {
		return `\n\n${content
			.split("\n")
			.map((line) => `> ${line}`)
			.join("\n")}\n\n`;
	},
});

turndown.addRule("strong", {
	filter: "strong",
	replacement(content) {
		return `**${content}**`;
	},
});

turndown.addRule("emphasis", {
	filter: "em",
	replacement(content) {
		return `*${content}*`;
	},
});

turndown.addRule("script-style", {
	filter: ["script", "style"],
	replacement: () => "",
});

turndown.addRule("button", {
	filter: "button",
	replacement: () => "",
});

turndown.addRule("nav-header-footer", {
	filter: ["nav", "header", "footer"],
	replacement: () => "",
});

export function toMarkdown(html: string): string {
	return turndown
		.turndown(html)
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}
