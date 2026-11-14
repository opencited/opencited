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
 * A missing scheduler, a missing next delayed job (for example deleted in Bull
 * Board), or a changed schedule has to be upserted. The upsert drops the
 * previous delayed job, so an overdue run gets one deterministic catch-up job.
 */
export function decideCrawlHealthSchedule(args: {
	existing: CrawlHealthSchedulerState | null | undefined;
	pattern: string;
	tz: string;
	now: number;
	/** Whether the delayed job for `existing.next` still exists. */
	nextJobExists: boolean;
}): CrawlHealthScheduleDecision {
	const { existing } = args;
	const exists = Boolean(existing?.pattern);
	const unchanged =
		exists && existing?.pattern === args.pattern && existing?.tz === args.tz;

	if (unchanged && args.nextJobExists) {
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
