import { describe, expect, it } from "bun:test";
import { probeRowFromCrawl } from "../src/scan/aiMentionProbe/probeRowFromCrawl";
import { runBrowserMentionProbe } from "../src/scan/aiMentionProbe/runBrowserMentionProbe";

describe("runBrowserMentionProbe", () => {
	it("returns ok with rows from successful crawls when one query fails", async () => {
		const probe = await runBrowserMentionProbe({
			domain: "acme.com",
			brandName: "Acme",
			queries: ["q1", "q2"],
			crawl: async (query) => {
				if (query === "q1") {
					throw new Error("browser down");
				}
				return {
					answer: "Acme widgets are popular.",
					citationUrls: ["https://acme.com"],
				};
			},
			rowFromCrawl: probeRowFromCrawl,
		});

		expect(probe.status).toBe("ok");
		if (probe.status === "ok") {
			expect(probe.queries).toHaveLength(1);
			expect(probe.queries[0]?.query).toBe("q2");
		}
	});

	it("returns unavailable when every crawl throws", async () => {
		const probe = await runBrowserMentionProbe({
			domain: "acme.com",
			brandName: "Acme",
			queries: ["q1"],
			crawl: async () => {
				throw new Error("fail");
			},
			rowFromCrawl: probeRowFromCrawl,
		});
		expect(probe).toEqual({ status: "unavailable" });
	});
});
