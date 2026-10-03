import { describe, expect, it } from "bun:test";
import {
	READINESS_BADGE_VARIANTS,
	READINESS_LABELS,
	READINESS_STROKE_CLASSES,
	formatScanDuration,
	scanErrorMessage,
} from "./scan-display";

describe("readiness display maps", () => {
	it("covers every readiness level with a label and a stroke class", () => {
		const levels = ["ready", "needs-work", "not-ready"] as const;
		for (const level of levels) {
			expect(READINESS_LABELS[level]).toBeTruthy();
			expect(READINESS_STROKE_CLASSES[level]).toContain("stroke-");
		}
	});

	it("maps readiness to semantic badge variants", () => {
		expect(READINESS_BADGE_VARIANTS.ready).toBe("success");
		expect(READINESS_BADGE_VARIANTS["needs-work"]).toBe("warning");
		expect(READINESS_BADGE_VARIANTS["not-ready"]).toBe("warning");
	});

	it("uses stroke colors that meet 3:1 non-text contrast in both themes", () => {
		expect(READINESS_STROKE_CLASSES.ready).toBe("stroke-emerald-600");
		expect(READINESS_STROKE_CLASSES["needs-work"]).toBe("stroke-amber-600");
		expect(READINESS_STROKE_CLASSES["not-ready"]).toBe(
			"stroke-muted-foreground",
		);
	});
});

describe("scanErrorMessage", () => {
	it("passes friendly messages through", () => {
		expect(scanErrorMessage('"example.com" is not a public domain.')).toBe(
			'"example.com" is not a public domain.',
		);
	});

	it("replaces raw validation payloads with actionable copy", () => {
		const zodPayload = '[{"origin":"string","code":"too_small"}]';
		expect(scanErrorMessage(zodPayload)).toBe(
			"Enter a domain like example.com and try again.",
		);
	});

	it("falls back to generic copy when no message is available", () => {
		expect(scanErrorMessage(undefined)).toBe(
			"Something went wrong while scanning. Please try again.",
		);
	});

	it("hides internal server errors behind friendly copy", () => {
		expect(scanErrorMessage("Internal server error")).toBe(
			"Something went wrong while scanning. Please try again.",
		);
	});
});

describe("formatScanDuration", () => {
	it("renders sub-second scans with one decimal", () => {
		expect(formatScanDuration(1200)).toBe("1.2s");
	});

	it("never renders below 0.1s", () => {
		expect(formatScanDuration(0)).toBe("0.1s");
	});
});
