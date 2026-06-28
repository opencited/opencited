"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/app/_trpc/client";
import { Button, Spinner } from "@opencited/ui";
import { useConfirmation } from "@/app/hooks/use-confirmation";
import { useActiveCrawls } from "@/app/hooks/use-active-crawls";
import {
	CRAWL_PROVIDER_OPTIONS,
	defaultCrawlProvider,
	type CrawlProviderId,
} from "./crawl-providers";

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
	const [selectedProvider, setSelectedProvider] =
		useState<CrawlProviderId>(defaultCrawlProvider);
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
		startCrawlMutation.mutate({
			promptQueryId,
			provider: selectedProvider,
		});
	};

	return (
		<>
			<div className="flex items-center gap-2">
				<select
					value={selectedProvider}
					onClick={(e) => e.stopPropagation()}
					onChange={(e) =>
						setSelectedProvider(e.target.value as CrawlProviderId)
					}
					className="h-8 rounded-md border border-input bg-background px-2 text-sm"
				>
					{CRAWL_PROVIDER_OPTIONS.map((opt) => (
						<option key={opt.id} value={opt.id}>
							{opt.label}
						</option>
					))}
				</select>
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
			</div>
			{dialog}
		</>
	);
}
