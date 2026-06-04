"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/app/_trpc/client";

interface UseActiveCrawlsOptions {
	domainProjectId: string | undefined;
	enabled?: boolean;
}

export function useActiveCrawls({
	domainProjectId,
	enabled = true,
}: UseActiveCrawlsOptions) {
	const trpc = useTRPC();

	const query = useQuery({
		...trpc.promptQueryCrawl.list.queryOptions({
			domainProjectId: domainProjectId ?? "",
			status: ["pending", "running"],
		}),
		enabled: enabled && !!domainProjectId,
		refetchInterval: 10000,
	});

	return {
		activeCrawls: query.data ?? [],
		isLoading: query.isLoading,
		refetch: query.refetch,
	};
}
