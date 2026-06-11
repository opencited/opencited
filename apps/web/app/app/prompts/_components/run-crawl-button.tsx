"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/app/_trpc/client";
import { Button, Spinner } from "@opencited/ui";
import { useConfirmation } from "@/app/hooks/use-confirmation";
import { useActiveCrawls } from "@/app/hooks/use-active-crawls";

import { toast } from "sonner";

interface RunCrawlButtonProps {
	promptQueryId: string;
	domainProjectId: string;
}

export function RunCrawlButton({
	promptQueryId,
	domainProjectId,
}: RunCrawlButtonProps) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [isSubmitting, setIsSubmitting] = useState(false);
	const { confirm, dialog } = useConfirmation();

	const { activeCrawls } = useActiveCrawls({
		domainProjectId,
	});

	const isRunning = activeCrawls.some(
		(crawl) => crawl.promptQueryId === promptQueryId,
	);

	const startCrawlMutation = useMutation(
		trpc.promptQueryCrawl.start.mutationOptions({
			onMutate: async () => {
				setIsSubmitting(true);
			},
			onSuccess: async () => {
				toast.success("Crawl started", {
					description: "Running crawl in background...",
				});
				queryClient.invalidateQueries({
					queryKey: trpc.promptQueryCrawl.list.queryKey({
						domainProjectId,
						status: ["pending", "running"],
					}),
				});
			},
			onSettled: () => {
				setIsSubmitting(false);
			},
			onError: (error) => {
				toast.error("Failed to start crawl", {
					description: error.message,
				});
			},
		}),
	);

	const handleClick = async (e: React.MouseEvent) => {
		e.stopPropagation();
		if (isRunning || isSubmitting) return;

		const confirmed = await confirm({
			title: "Run Crawl",
			description:
				"Are you sure you want to run a crawl for this prompt? This will fetch data from AI answer engines and may take a few moments.",
			confirmLabel: "Run Crawl",
		});

		if (!confirmed) return;
		startCrawlMutation.mutate({ promptQueryId, provider: "perplexity" });
	};

	return (
		<>
			<Button
				variant="outline"
				size="sm"
				onClick={handleClick}
				disabled={isRunning || isSubmitting}
				className="gap-2 run-crawl-btn"
			>
				{(isRunning || isSubmitting) && <Spinner className="h-3 w-3" />}
				{isRunning || isSubmitting ? "Running..." : "Run Crawl"}
			</Button>
			{dialog}
		</>
	);
}
