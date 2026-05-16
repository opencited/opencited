"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/app/_trpc/client";
import { Button, Spinner } from "@opencited/ui";
import { useConfirmation } from "@/app/hooks/use-confirmation";

import { toast } from "sonner";

interface RunCrawlButtonProps {
	promptQueryId: string;
	isRunning?: boolean;
	onCrawlStart?: () => void;
}

export function RunCrawlButton({
	promptQueryId,
	isRunning = false,
	onCrawlStart,
}: RunCrawlButtonProps) {
	const trpc = useTRPC();
	const [isSubmitting, setIsSubmitting] = useState(false);
	const { confirm, dialog } = useConfirmation();

	const startCrawlMutation = useMutation(
		trpc.promptQueryCrawl.start.mutationOptions({
			onMutate: async () => {
				setIsSubmitting(true);
				onCrawlStart?.();
			},
			onSuccess: async () => {
				toast.success("Crawl started", {
					description: "Running crawl in background...",
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
		startCrawlMutation.mutate({ promptQueryId });
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
