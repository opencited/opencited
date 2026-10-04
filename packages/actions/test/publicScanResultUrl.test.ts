import { describe, expect, it } from "bun:test";
import { publicScanResultUrl } from "../src/scan/publicScanResultUrl";

describe("publicScanResultUrl", () => {
	it("builds a scan URL without a trailing slash on the origin", () => {
		const id = "550e8400-e29b-41d4-a716-446655440000";
		expect(publicScanResultUrl("https://opencited.com", id)).toBe(
			`https://opencited.com/scan/${id}`,
		);
		expect(publicScanResultUrl("https://opencited.com/", id)).toBe(
			`https://opencited.com/scan/${id}`,
		);
	});
});
