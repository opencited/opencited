export const CRAWL_HEALTH_CHECK_SCHEDULER_ID = "crawl-health-check-daily";

export interface CrawlHealthSchedulerState {
	pattern?: string | null;
	tz?: string | null;
	next?: number | null;
}

export interface CrawlHealthScheduleDecision {
	action: "keep" | "upsert";
	/** Deterministic id for a one-off catch-up run, or null. */
	catchUpJobId: string | null;
}

/**
 * `YYYY-MM-DD` in the configured timezone. The date is part of the catch-up
 * job id so two restarts on the same day cannot enqueue two catch-up runs.
 */
export function crawlHealthCatchUpJobId(now: number, timeZone: string): string {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).formatToParts(new Date(now));
	const part = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((candidate) => candidate.type === type)?.value ?? "";

	return `crawl-health-check-catchup-${part("year")}-${part("month")}-${part("day")}`;
}

/**
 * Decides whether the startup registration has to rewrite the BullMQ job
 * scheduler.
 *
 * BullMQ's `upsertJobScheduler` replaces the scheduler every time and deletes
 * the previous delayed job. When the pattern and timezone are unchanged we
 * leave the scheduler alone so an overdue run survives a worker restart.
 *
 * A changed schedule has to be upserted, but the upsert would drop an overdue
 * run. In that case the caller enqueues one deterministic catch-up job.
 */
export function decideCrawlHealthSchedule(args: {
	existing: CrawlHealthSchedulerState | null | undefined;
	pattern: string;
	tz: string;
	now: number;
}): CrawlHealthScheduleDecision {
	const { existing } = args;
	const exists = Boolean(existing?.pattern);
	const unchanged =
		exists && existing?.pattern === args.pattern && existing?.tz === args.tz;

	if (unchanged) {
		return { action: "keep", catchUpJobId: null };
	}

	if (!exists) {
		return { action: "upsert", catchUpJobId: null };
	}

	const nextIsOverdue =
		typeof existing?.next === "number" && existing.next <= args.now;

	return {
		action: "upsert",
		catchUpJobId: nextIsOverdue
			? crawlHealthCatchUpJobId(args.now, args.tz)
			: null,
	};
}
