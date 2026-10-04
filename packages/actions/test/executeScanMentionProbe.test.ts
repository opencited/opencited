import { describe, expect, it } from "bun:test";
import { executeScanMentionProbe } from "../src/scan/aiMentionProbe/executeScanMentionProbe";

describe("executeScanMentionProbe", () => {
	it("maps crawl results through probeRowFromCrawl", async () => {
		const probe = await executeScanMentionProbe(
			{
				publicScanId: "00000000-0000-4000-8000-000000000001",
				domain: "acme.com",
				brandName: "Acme",
				queries: ["best widgets"],
			},
			async () => ({
				answer: "See https://acme.com for details.",
				citationUrls: ["https://acme.com"],
			}),
		);

		expect(probe.status).toBe("ok");
		if (probe.status === "ok") {
			expect(probe.queries[0]?.visibility).toBe("visible");
		}
	});

	it("returns unavailable when all crawls fail", async () => {
		const probe = await executeScanMentionProbe(
			{
				publicScanId: "00000000-0000-4000-8000-000000000001",
				domain: "acme.com",
				brandName: "Acme",
				queries: ["q1", "q2"],
			},
			async () => {
				throw new Error("fail");
			},
		);
		expect(probe).toEqual({ status: "unavailable" });
	});
});
