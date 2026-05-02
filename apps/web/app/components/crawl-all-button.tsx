"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/app/_trpc/client";
import { Button } from "@opencited/ui";
import { Play, Loader2, CheckCircle, XCircle } from "lucide-react";
import { useConfirmation } from "@/app/hooks/use-confirmation";

interface CrawlAllButtonProps {
	sitemapId: string;
	sitemapActiveCrawlRunId: string | null;
	isBusy?: boolean;
}

export function CrawlAllButton({
	sitemapId,
	sitemapActiveCrawlRunId,
	isBusy,
}: CrawlAllButtonProps) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const { confirm, dialog } = useConfirmation();
	const [error, setError] = useState<string | null>(null);
	const [result, setResult] = useState<{
		succeeded: number;
		failed: number;
	} | null>(null);

	const mutation = useMutation(
		trpc.crawl.triggerSitemapCrawl.mutationOptions({
			onError: (err) => {
				setError(err.message || "Crawl failed. Try again.");
				setResult(null);
			},
			onSuccess: (data) => {
				setError(null);
				setResult({ succeeded: data.succeeded, failed: data.failed });
				queryClient.invalidateQueries(
					trpc.sitemap.listUrls.queryOptions({ sitemapId }),
				);
			},
		}),
	);

	const isBlocked =
		mutation.isPending || sitemapActiveCrawlRunId !== null || isBusy;

	return (
		<div className="flex flex-col gap-1">
			{dialog}
			<Button
				variant="default"
				size="sm"
				disabled={isBlocked}
				onClick={async () => {
					const isConfirmed = await confirm({
						title: "Crawl all URLs?",
						description:
							"Are you sure you want to crawl all URLs in this sitemap?",
					});
					if (!isConfirmed) return;
					setError(null);
					setResult(null);
					mutation.mutate({ sitemapId });
				}}
				className="gap-1.5"
			>
				{mutation.isPending ? (
					<Loader2 className="h-4 w-4 animate-spin" />
				) : (
					<Play className="h-4 w-4" />
				)}
				{mutation.isPending
					? "Crawling..."
					: sitemapActiveCrawlRunId
						? "Running..."
						: "Crawl All"}
			</Button>
			{error && (
				<span className="text-xs text-destructive flex items-center gap-1">
					<XCircle className="h-3 w-3" />
					{error}
				</span>
			)}
			{result && !error && (
				<span className="text-xs text-muted-foreground flex items-center gap-1">
					<CheckCircle className="h-3 w-3 text-emerald-500" />
					{result.succeeded} crawled
					{result.failed > 0 && `, ${result.failed} failed`}
				</span>
			)}
		</div>
	);
}
