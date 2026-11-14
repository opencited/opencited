import { describe, expect, it } from "bun:test";
import {
	crawlHealthCatchUpJobId,
	decideCrawlHealthSchedule,
} from "../src/lib/crawl-health-schedule";

const PATTERN = "0 0 6 * * *";
const TZ = "Asia/Kolkata";
const NOW = Date.parse("2026-11-14T01:00:00Z"); // 06:30 IST

describe("decideCrawlHealthSchedule", () => {
	it("upserts when the scheduler is missing", () => {
		expect(
			decideCrawlHealthSchedule({
				existing: undefined,
				pattern: PATTERN,
				tz: TZ,
				now: NOW,
			}),
		).toEqual({ action: "upsert", catchUpJobId: null });
	});

	it("keeps an unchanged scheduler so an overdue delayed job survives", () => {
		expect(
			decideCrawlHealthSchedule({
				existing: {
					pattern: PATTERN,
					tz: TZ,
					next: NOW - 30 * 60 * 1000,
				},
				pattern: PATTERN,
				tz: TZ,
				now: NOW,
			}),
		).toEqual({ action: "keep", catchUpJobId: null });
	});

	it("upserts a changed scheduler and catches up an overdue run", () => {
		expect(
			decideCrawlHealthSchedule({
				existing: {
					pattern: "0 30 5 * * *",
					tz: TZ,
					next: NOW - 60 * 60 * 1000,
				},
				pattern: PATTERN,
				tz: TZ,
				now: NOW,
			}),
		).toEqual({
			action: "upsert",
			catchUpJobId: "crawl-health-check-catchup-2026-11-14",
		});
	});

	it("does not catch up when a changed scheduler's next run is still ahead", () => {
		expect(
			decideCrawlHealthSchedule({
				existing: {
					pattern: PATTERN,
					tz: "UTC",
					next: NOW + 60 * 60 * 1000,
				},
				pattern: PATTERN,
				tz: TZ,
				now: NOW,
			}),
		).toEqual({ action: "upsert", catchUpJobId: null });
	});
});

describe("crawlHealthCatchUpJobId", () => {
	it("uses the calendar date in the configured timezone", () => {
		// 2026-11-13T20:00:00Z is already 14 Nov in IST.
		const now = Date.parse("2026-11-13T20:00:00Z");
		expect(crawlHealthCatchUpJobId(now, TZ)).toBe(
			"crawl-health-check-catchup-2026-11-14",
		);
		expect(crawlHealthCatchUpJobId(now, "UTC")).toBe(
			"crawl-health-check-catchup-2026-11-13",
		);
	});
});
