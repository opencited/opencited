import { describe, expect, it } from "bun:test";
import { filterCategoryQueries } from "../src/scan/aiMentionProbe/filterCategoryQueries";

describe("filterCategoryQueries", () => {
	it("drops queries that mention the brand or domain", () => {
		const filtered = filterCategoryQueries(
			[
				"best issue tracker for startups",
				"is acme tools good",
				"acme.com pricing",
			],
			{ brandName: "Acme Tools", domain: "acme.com" },
		);
		expect(filtered).toEqual(["best issue tracker for startups"]);
	});

	it("drops queries when only a brand token matches (pipe in brand name)", () => {
		const filtered = filterCategoryQueries(
			["What are the best Transform your standard forms with ConvoForm tools?"],
			{
				brandName: "ConvoForm | Create Conversational Forms",
				domain: "convoform.com",
			},
		);
		expect(filtered).toEqual([]);
	});

	it("keeps one or two survivors", () => {
		const filtered = filterCategoryQueries(
			["best CRM software", "acme crm review"],
			{ brandName: "Acme", domain: "acme.io" },
		);
		expect(filtered).toEqual(["best CRM software"]);
	});
});
