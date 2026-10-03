import { describe, expect, it } from "bun:test";
import {
	publicScanResultLink,
	resolvePublicAppOrigin,
} from "../src/scan/appOrigin";

describe("resolvePublicAppOrigin", () => {
	it("prefers an explicit override and strips a trailing slash", () => {
		expect(resolvePublicAppOrigin("https://app.example.com/")).toBe(
			"https://app.example.com",
		);
	});
});

describe("publicScanResultLink", () => {
	it("builds a result URL from an override origin", () => {
		const id = "550e8400-e29b-41d4-a716-446655440000";
		expect(publicScanResultLink(id, "https://opencited.com")).toBe(
			`https://opencited.com/scan/${id}`,
		);
	});
});
