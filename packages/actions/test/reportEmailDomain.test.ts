import { describe, expect, it } from "bun:test";
import {
	buildReportEmail,
	emailHostForScanDomain,
	emailMatchesScanDomain,
} from "../src/scan/reportEmailDomain";

describe("reportEmailDomain", () => {
	it("strips www from the required email host", () => {
		expect(emailHostForScanDomain("www.oration.ai")).toBe("oration.ai");
		expect(emailHostForScanDomain("blog.oration.ai")).toBe("blog.oration.ai");
	});

	it("matches only emails on the scan domain host", () => {
		expect(emailMatchesScanDomain("jane@oration.ai", "www.oration.ai")).toBe(
			true,
		);
		expect(emailMatchesScanDomain("jane@gmail.com", "oration.ai")).toBe(false);
	});

	it("builds a full address from the local part", () => {
		expect(buildReportEmail("jane", "www.oration.ai")).toBe("jane@oration.ai");
	});
});
