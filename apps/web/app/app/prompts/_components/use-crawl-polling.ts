"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/app/_trpc/client";

interface UseCrawlPollingOptions {
	runningCrawlIds: Set<string>;
	enabled?: boolean;
}

interface UseCrawlPollingReturn {
	completedCrawlIds: Set<string>;
}

export function useCrawlPolling({
	runningCrawlIds,
	enabled = true,
}: UseCrawlPollingOptions): UseCrawlPollingReturn {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [completedCrawlIds, setCompletedCrawlIds] = useState<Set<string>>(
		new Set(),
	);
	const runningCrawlIdsRef = useRef(runningCrawlIds);

	useEffect(() => {
		runningCrawlIdsRef.current = runningCrawlIds;
	}, [runningCrawlIds]);

	const pollCrawls = useCallback(async () => {
		const currentRunning = runningCrawlIdsRef.current;
		if (currentRunning.size === 0) return;

		const updatedCrawls = await Promise.all(
			Array.from(currentRunning).map(async (id) => {
				try {
					return await queryClient.fetchQuery({
						...trpc.promptQueryCrawl.get.queryOptions({ id }),
					});
				} catch {
					return null;
				}
			}),
		);

		const stillRunning = new Set<string>();
		const newlyCompleted = new Set<string>();

		updatedCrawls.forEach((crawl: any) => {
			if (!crawl) return;
			if (crawl.status === "running" || crawl.status === "pending") {
				stillRunning.add(crawl.id);
			} else if (crawl.status === "completed" || crawl.status === "failed") {
				newlyCompleted.add(crawl.id);
			}
		});

		if (newlyCompleted.size > 0) {
			setCompletedCrawlIds((prev) => {
				const next = new Set(prev);
				for (const id of newlyCompleted) {
					next.add(id);
				}
				return next;
			});
		}
	}, [trpc, queryClient]);

	useEffect(() => {
		if (!enabled || runningCrawlIds.size === 0) return;

		const pollInterval = setInterval(pollCrawls, 3000);

		return () => clearInterval(pollInterval);
	}, [enabled, runningCrawlIds.size, pollCrawls]);

	return { completedCrawlIds };
}
