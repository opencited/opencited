"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/app/_trpc/client";
import { Button } from "@opencited/ui";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface RunCrawlButtonProps {
	promptQueryId: string;
	isRunning?: boolean;
	onCrawlStart?: () => void;
	onCrawlComplete?: () => void;
}

export function RunCrawlButton({
	promptQueryId,
	isRunning = false,
	onCrawlStart,
	onCrawlComplete,
}: RunCrawlButtonProps) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [isSubmitting, setIsSubmitting] = useState(false);

	const startCrawlMutation = useMutation(
		trpc.promptQueryCrawl.start.mutationOptions({
			onMutate: async () => {
				setIsSubmitting(true);
				onCrawlStart?.();
			},
			onSuccess: async (data: { crawlId: string; runId: string }) => {
				toast.success("Crawl started", {
					description: "Running crawl in background...",
				});

				// Poll for status updates
				const pollInterval = setInterval(async () => {
					const updatedCrawl = await queryClient.fetchQuery({
						...trpc.promptQueryCrawl.get.queryOptions({ id: data.crawlId }),
					});

					if (
						updatedCrawl?.status === "completed" ||
						updatedCrawl?.status === "failed"
					) {
						clearInterval(pollInterval);
						toast.success(
							updatedCrawl.status === "completed"
								? "Crawl completed"
								: "Crawl failed",
							{
								description:
									updatedCrawl.status === "failed"
										? updatedCrawl.error
										: undefined,
							},
						);
						onCrawlComplete?.();

						// Refetch prompts list to update lastCrawledAt
						await queryClient.invalidateQueries({
							queryKey: ["promptQuery", "list"],
						});
						await queryClient.invalidateQueries({
							queryKey: ["promptQueryCrawl", "list"],
						});
					}

					if (updatedCrawl?.status === "running" && !isRunning) {
						toast.info("Crawl in progress", {
							description: "Fetching data from Perplexity...",
						});
					}
				}, 2000);
			},
			onError: (error) => {
				toast.error("Failed to start crawl", {
					description: error.message,
				});
				setIsSubmitting(false);
			},
		}),
	);

	const handleClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		if (isRunning || isSubmitting) return;

		startCrawlMutation.mutate({ promptQueryId });
	};

	return (
		<Button
			variant="outline"
			size="sm"
			onClick={handleClick}
			disabled={isRunning || isSubmitting}
			className="gap-2"
		>
			{(isRunning || isSubmitting) && (
				<Loader2 className="h-3 w-3 animate-spin" />
			)}
			{isRunning || isSubmitting ? "Running..." : "Run Crawl"}
		</Button>
	);
}
