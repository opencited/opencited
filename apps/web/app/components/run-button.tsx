"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/app/_trpc/client";
import { Button } from "@opencited/ui";
import { Play, Loader2 } from "lucide-react";

interface RunButtonProps {
	sitemapUrlId: string;
	url: string;
	sitemapId: string;
	activeCrawlRunId: string | null;
	sitemapActiveCrawlRunId: string | null;
}

export function RunButton({
	sitemapUrlId,
	url,
	sitemapId,
	activeCrawlRunId,
	sitemapActiveCrawlRunId,
}: RunButtonProps) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [error, setError] = useState<string | null>(null);

	const mutation = useMutation(
		trpc.crawl.triggerSingleCrawl.mutationOptions({
			onError: (err) => {
				setError(err.message || "Crawl failed. Try again.");
			},
			onSuccess: () => {
				setError(null);
				queryClient.invalidateQueries(
					trpc.sitemap.listUrls.queryOptions({ sitemapId }),
				);
			},
		}),
	);

	const isBlocked =
		mutation.isPending ||
		sitemapActiveCrawlRunId !== null ||
		activeCrawlRunId !== null;

	return (
		<div className="flex flex-col items-end gap-1">
			<Button
				variant="ghost"
				size="sm"
				disabled={isBlocked}
				onClick={() => {
					setError(null);
					mutation.mutate({ sitemapUrlId, url });
				}}
				className="gap-1.5"
			>
				{mutation.isPending ? (
					<Loader2 className="h-4 w-4 animate-spin" />
				) : (
					<Play className="h-4 w-4" />
				)}
				Run
			</Button>
			{error && <span className="text-xs text-destructive">{error}</span>}
		</div>
	);
}
